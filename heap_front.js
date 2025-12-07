let heap = null;
const svgNs = "http://www.w3.org/2000/svg";
let isAnimating = false;
let currentArray = []; // Matches visual state

Module.onRuntimeInitialized = function() {
    heap = new Module.HeapBackend();
    console.log("Heap Ready"); 
    syncFromBackend();
};

function syncFromBackend() {
    const rawVec = heap.getArray();
    currentArray = [];
    for(let i=0; i<rawVec.size(); i++) currentArray.push(rawVec.get(i));
    renderTree(currentArray);
    renderArray(currentArray);
}

// --- Render Logic ---

function renderArray(arr) {
    const container = document.getElementById('arrayContainer');
    container.innerHTML = '';
    
    arr.forEach((val, idx) => {
        const div = document.createElement('div');
        div.className = 'array-cell';
        div.id = `cell-${idx}`;
        div.innerHTML = `<span class="cell-val">${val}</span><span class="cell-idx">${idx}</span>`;
        container.appendChild(div);
    });
}

function renderTree(arr) {
    const edgesLayer = document.getElementById('edgesLayer');
    const nodesLayer = document.getElementById('nodesLayer');
    edgesLayer.innerHTML = '';
    nodesLayer.innerHTML = '';

    if(arr.length === 0) return;

    const width = document.getElementById('treeSvg').clientWidth;
    const startY = 50;
    const levelHeight = 70;
    
    // Calculate positions
    const positions = [];
    function calcPos(idx, x, y, offset) {
        if(idx >= arr.length) return;
        positions[idx] = {x, y};
        calcPos(2*idx + 1, x - offset, y + levelHeight, offset/2);
        calcPos(2*idx + 2, x + offset, y + levelHeight, offset/2);
    }
    calcPos(0, width/2, startY, width/4);

    // Draw Edges
    for(let i=1; i<arr.length; i++) {
        const p = Math.floor((i-1)/2);
        const start = positions[p];
        const end = positions[i];
        
        const line = document.createElementNS(svgNs, "line");
        line.setAttribute("x1", start.x); line.setAttribute("y1", start.y);
        line.setAttribute("x2", end.x); line.setAttribute("y2", end.y);
        line.setAttribute("class", "edge");
        edgesLayer.appendChild(line);
    }

    // Draw Nodes
    arr.forEach((val, i) => {
        const pos = positions[i];
        const g = document.createElementNS(svgNs, "g");
        g.setAttribute("transform", `translate(${pos.x}, ${pos.y})`);
        g.setAttribute("class", "node-group");
        g.setAttribute("id", `node-${i}`); // CRITICAL: ID is based on INDEX

        const c = document.createElementNS(svgNs, "circle");
        c.setAttribute("r", 22);
        c.setAttribute("class", "node-circle");

        const t = document.createElementNS(svgNs, "text");
        t.setAttribute("class", "node-text");
        t.textContent = val;

        g.appendChild(c);
        g.appendChild(t);
        nodesLayer.appendChild(g);
    });
}

// --- Handlers ---
function handleModeChange(isMin) {
    if(isAnimating) return;
    heap.setMode(isMin);
    syncFromBackend();
}

function handleInsert() {
    if(isAnimating) return;
    const val = parseInt(document.getElementById('valInput').value);
    if(isNaN(val)) return;
    const logs = heap.insert(val);
    animate(logs);
    document.getElementById('valInput').value = '';
}

function handleExtract() {
    if(isAnimating) return;
    const logs = heap.extract();
    animate(logs);
}

// --- Animation Engine ---
function animate(logs) {
    isAnimating = true;
    let i = 0;
    const sb = document.getElementById('statusBar');

    function step() {
        if(i >= logs.size()) {
            isAnimating = false;
            sb.innerText = "Operation Complete";
            syncFromBackend(); // Final strict sync
            return;
        }

        const log = logs.get(i);
        sb.innerText = log.info;

        if (log.action === "insert") {
            // Logically update our JS mirror so render works
            currentArray.push(log.indexB); // indexB stores value here
            highlight(currentArray.length - 1, '#34c759');
            renderTree(currentArray);
            renderArray(currentArray);
        }
        else if (log.action === "highlight") {
            highlight(log.indexA, '#ff9500'); // Orange for compare
            highlight(log.indexB, '#ff9500');
        }
        else if (log.action === "swap") {
            // 1. Perform Smooth Visual Transition
            doVisualSwap(log.indexA, log.indexB);
            
            // 2. Update JS Mirror immediately so data is correct
            const temp = currentArray[log.indexA];
            currentArray[log.indexA] = currentArray[log.indexB];
            currentArray[log.indexB] = temp;
        }
        else if (log.action === "extract") {
            // The root was moved to end and popped in logic
            currentArray.pop();
            renderTree(currentArray);
            renderArray(currentArray);
        }

        i++;
        
        // Wait for animation to finish, THEN Step
        setTimeout(() => {
            // --- THE FIX ---
            // Before the next step runs, we force a re-render.
            // This destroys the old SVG nodes (which are visually swapped but have old IDs)
            // and creates NEW SVG nodes where node-0 is actually at the top.
            // Since the visual animation just finished moving them to these spots, 
            // the user sees no jump, but the DOM is now corrected for the next swap.
            if(log.action === "swap") {
                renderTree(currentArray);
                renderArray(currentArray);
            }
            step();
        }, 800);
    }
    step();
}

function highlight(idx, color) {
    const node = document.querySelector(`#node-${idx} circle`);
    if(node) {
        node.style.fill = color;
        setTimeout(() => node.style.fill = '#1c1c1e', 600);
    }
    const cell = document.getElementById(`cell-${idx}`);
    if(cell) {
        cell.style.backgroundColor = color;
        cell.children[0].style.color = 'white';
        setTimeout(() => {
            cell.style.backgroundColor = 'white';
            cell.children[0].style.color = '#1c1c1e';
        }, 600);
    }
}

function doVisualSwap(idx1, idx2) {
    const n1 = document.getElementById(`node-${idx1}`);
    const n2 = document.getElementById(`node-${idx2}`);
    const c1 = document.getElementById(`cell-${idx1}`);
    const c2 = document.getElementById(`cell-${idx2}`);

    if(!n1 || !n2) return;

    // SVG Swap
    const t1 = parseTranslate(n1);
    const t2 = parseTranslate(n2);
    n1.style.transform = `translate(${t2.x}px, ${t2.y}px)`;
    n2.style.transform = `translate(${t1.x}px, ${t1.y}px)`;

    // Array Swap (Simple translate x)
    if(c1 && c2) {
        const dist = c2.offsetLeft - c1.offsetLeft;
        c1.style.transform = `translateX(${dist}px)`;
        c2.style.transform = `translateX(${-dist}px)`;
    }
}

function parseTranslate(el) {
    const str = el.getAttribute('transform');
    const match = /translate\(([^,]+),\s*([^)]+)\)/.exec(str);
    return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
}