let avl = null;
const svgNs = "http://www.w3.org/2000/svg";
let isAnimating = false;
let currentNodesData = [];

Module.onRuntimeInitialized = function() {
    avl = new Module.AVLBackend();
    console.log("AVL WASM Ready");
    
    redrawTree();
};

function handleInsert() {
    if(isAnimating) return;
    const val = parseInt(document.getElementById('valInput').value);
    if(isNaN(val)) return;
    
    const logs = avl.insert(val);
    
    animateSequence(logs);
    document.getElementById('valInput').value = '';
}

function handleDelete() {
    if(isAnimating) return;
    const val = parseInt(document.getElementById('valInput').value);
    if(isNaN(val)) return;

    const logs = avl.remove(val);
    animateSequence(logs);
    document.getElementById('valInput').value = '';
}

function animateSequence(logs) {
    isAnimating = true;
    let i = 0;
    const focusRing = document.getElementById('focusRing');
    const statusDiv = document.getElementById('statusBar');
    
    function step() {
        if(i >= logs.size()) {
            isAnimating = false;
            focusRing.setAttribute('opacity', '0');
            statusDiv.innerText = "Operation Complete.";
            redrawTree();
            return;
        }

        const log = logs.get(i);
        statusDiv.innerText = log.action + ": " + log.info;

        if (log.action === 'search_visit') {
            const nodeGroup = document.getElementById(`node-${log.key}`);
            if(nodeGroup) {
                const transform = nodeGroup.getAttribute('transform'); 
                const match = /translate\(([^,]+),\s*([^)]+)\)/.exec(transform);
                if(match) {
                    focusRing.setAttribute('cx', match[1]);
                    focusRing.setAttribute('cy', match[2]);
                    focusRing.setAttribute('opacity', '1');
                }
            }
        } 
        else if (log.action === 'insert_node') {
            statusDiv.innerText = `Adding Node ${log.key}`;
        }
        else if (log.action === 'rotate_event') {
            statusDiv.innerText = `Tree Balancing: ${log.info}`;
        }

        i++;
        setTimeout(step, 500);
    }
    step();
}


function redrawTree() {
    const rawData = avl.getTreeStructure(); 
    currentNodesData = [];
    
    let nodeMap = {};
    let rootId = -1;
    
    for(let i=0; i<rawData.size(); i++) {
        let n = rawData.get(i);
        let obj = { 
            key: n.key, 
            h: n.height, 
            bf: n.bf, 
            left: n.leftKey, 
            right: n.rightKey 
        };
        currentNodesData.push(obj);
        nodeMap[n.key] = obj;
    }
    
    const nodesLayer = document.getElementById('nodesLayer');
    const edgesLayer = document.getElementById('edgesLayer');
    nodesLayer.innerHTML = '';
    edgesLayer.innerHTML = '';
    
    if (currentNodesData.length === 0) return;

    const canvasWidth = document.getElementById('treeSvg').clientWidth;
    const startY = 60;
    const levelHeight = 70;

    function drawNodeRecursive(nodeKey, x, y, offsetX) {
        if(nodeKey === -1) return;
        
        const node = nodeMap[nodeKey];
        
        node.x = x; 
        node.y = y;

        if (node.left !== -1) {
            drawEdge(x, y, x - offsetX, y + levelHeight);
            drawNodeRecursive(node.left, x - offsetX, y + levelHeight, offsetX / 2);
        }
        if (node.right !== -1) {
            drawEdge(x, y, x + offsetX, y + levelHeight);
            drawNodeRecursive(node.right, x + offsetX, y + levelHeight, offsetX / 2);
        }
    }

    if(currentNodesData.length > 0) {
        drawNodeRecursive(currentNodesData[0].key, canvasWidth / 2, startY, canvasWidth / 4);
    }

    currentNodesData.forEach(n => {
        drawNodeVisual(n);
    });
}

function drawEdge(x1, y1, x2, y2) {
    const el = document.createElementNS(svgNs, "line");
    el.setAttribute("x1", x1);
    el.setAttribute("y1", y1);
    el.setAttribute("x2", x2);
    el.setAttribute("y2", y2);
    el.setAttribute("class", "edge");
    document.getElementById('edgesLayer').appendChild(el);
}

function drawNodeVisual(node) {
    const g = document.createElementNS(svgNs, "g");
    g.setAttribute("class", "node-group");
    g.setAttribute("transform", `translate(${node.x}, ${node.y})`);
    g.setAttribute("id", `node-${node.key}`);
    
    g.addEventListener('mouseenter', (e) => showTooltip(e, node));
    g.addEventListener('mouseleave', hideTooltip);

    const c = document.createElementNS(svgNs, "circle");
    c.setAttribute("r", 20);
    c.setAttribute("class", "node-circle");

    const t = document.createElementNS(svgNs, "text");
    t.setAttribute("class", "node-text");
    t.textContent = node.key;

    g.appendChild(c);
    g.appendChild(t);
    document.getElementById('nodesLayer').appendChild(g);
}

const tooltip = document.getElementById('tooltip');

function showTooltip(evt, node) {
    const rect = document.getElementById(`node-${node.key}`).getBoundingClientRect();
    
    tooltip.innerHTML = `
        <strong>Node ${node.key}</strong><br>
        Height: ${node.h}<br>
        Balance Factor: <span style="color: ${node.bf === 0 ? '#34c759' : '#ff3b30'}">${node.bf}</span>
    `;
    tooltip.style.left = (rect.left + 20) + 'px';
    tooltip.style.top = (rect.top - 10) + 'px';
    tooltip.classList.add('visible');
}

function hideTooltip() {
    tooltip.classList.remove('visible');
}