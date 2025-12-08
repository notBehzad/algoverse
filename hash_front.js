let hashTable = null;
const svgNs = "http://www.w3.org/2000/svg";
let isAnimating = false;

const BUCKET_WIDTH = 60;
const BUCKET_HEIGHT = 40;
const CHAIN_W = 50;
const CHAIN_H = 35;
const GAP_X = 20;
const GAP_Y = 30;
const START_X = 50;
const START_Y = 40;

Module.onRuntimeInitialized = function() {
    hashTable = new Module.HashTableBackend();
    console.log("Hash WASM Ready");
    renderTable();
};

function renderTable() {
    const bucketsLayer = document.getElementById('bucketsLayer');
    const chainsLayer = document.getElementById('chainsLayer');
    const connectorsLayer = document.getElementById('connectorsLayer');
    
    bucketsLayer.innerHTML = '';
    chainsLayer.innerHTML = '';
    connectorsLayer.innerHTML = '';

    const snapshot = hashTable.getSnapshot();

    for (let i = 0; i < snapshot.size(); i++) {
        const bucketData = snapshot.get(i);
        const idx = bucketData.index;
        const keys = bucketData.keys;

        const bx = START_X + (BUCKET_WIDTH + GAP_X) * idx;
        const by = START_Y;
        
        const bGroup = document.createElementNS(svgNs, "g");
        bGroup.setAttribute("id", `bucket-${idx}`);
        bGroup.setAttribute("transform", `translate(${bx}, ${by})`);
        bGroup.innerHTML = `
            <rect class="bucket-rect" width="${BUCKET_WIDTH}" height="${BUCKET_HEIGHT}"></rect>
            <text class="bucket-text" x="${BUCKET_WIDTH/2}" y="${BUCKET_HEIGHT/2}">[ ]</text>
            <text class="bucket-idx" x="${BUCKET_WIDTH/2}" y="${BUCKET_HEIGHT + 15}">${idx}</text>
        `;
        bucketsLayer.appendChild(bGroup);

        let prevY = by + BUCKET_HEIGHT;
        let cy = by + BUCKET_HEIGHT + GAP_Y;

        for (let j = 0; j < keys.size(); j++) {
            const val = keys.get(j);
            const cx = bx + (BUCKET_WIDTH - CHAIN_W) / 2;
            
            const destinationY = cy; 

            const line = document.createElementNS(svgNs, "line");
            line.setAttribute("x1", bx + BUCKET_WIDTH/2);
            line.setAttribute("y1", prevY);
            line.setAttribute("x2", bx + BUCKET_WIDTH/2);
            line.setAttribute("y2", cy - 5);
            line.setAttribute("class", "connector");
            connectorsLayer.appendChild(line);

            const cGroup = document.createElementNS(svgNs, "g");
            cGroup.setAttribute("id", `chain-${idx}-node-${j}`); 
            cGroup.setAttribute("class", "chain-group");
            cGroup.setAttribute("data-val", val);

            cGroup.style.transform = `translate(${cx}px, ${cy + 15}px)`;
            cGroup.style.opacity = '0';
            
            cGroup.innerHTML = `
                <rect class="chain-rect" width="${CHAIN_W}" height="${CHAIN_H}"></rect>
                <text class="chain-text" x="${CHAIN_W/2}" y="${CHAIN_H/2}">${val}</text>
            `;
            chainsLayer.appendChild(cGroup);

            requestAnimationFrame(() => {
                cGroup.style.transform = `translate(${cx}px, ${destinationY}px)`;
                cGroup.style.opacity = '1';
            });

            prevY = cy + CHAIN_H;
            cy += CHAIN_H + GAP_Y;
        }
    }
}

function handleInsert() {
    if(isAnimating) return;
    const val = parseInt(document.getElementById('valInput').value);
    if(isNaN(val)) return;
    
    resetVisuals();
    const logs = hashTable.insert(val);
    animate(logs);
    document.getElementById('valInput').value = '';
}

function handleSearch() {
    if(isAnimating) return;
    const val = parseInt(document.getElementById('valInput').value);
    if(isNaN(val)) return;
    
    resetVisuals();
    const logs = hashTable.search(val);
    animate(logs);
}

function resetVisuals() {
    document.querySelectorAll('.highlight-bucket').forEach(e => e.classList.remove('highlight-bucket'));
    document.querySelectorAll('.found-node').forEach(e => e.classList.remove('found-node'));
    document.querySelectorAll('.error-node').forEach(e => e.classList.remove('error-node'));
    document.querySelectorAll('.chain-rect').forEach(r => r.style.stroke = '');
}

function animate(logs) {
    isAnimating = true;
    let i = 0;
    const sb = document.getElementById('statusBar');

    function step() {
        if(i >= logs.size()) {
            isAnimating = false;
            setTimeout(renderTable, 300);
            return;
        }

        const log = logs.get(i);
        sb.innerText = log.info;

        document.querySelectorAll('.highlight-bucket').forEach(e => e.classList.remove('highlight-bucket'));
        document.querySelectorAll('.chain-rect').forEach(r => {
             if(!r.parentElement.classList.contains('found-node')) r.style.stroke = '';
        });

        if (log.action === "compute_hash") {
            const b = document.querySelector(`#bucket-${log.bucketIdx} .bucket-rect`);
            if(b) b.classList.add('highlight-bucket');
        }
        else if (log.action === "traverse") {
            const b = document.querySelector(`#bucket-${log.bucketIdx} .bucket-rect`);
            if(b) b.classList.add('highlight-bucket');
            
            const node = document.querySelector(`g[data-val="${log.keyVal}"]`);
            if(node) node.querySelector('rect').style.stroke = '#007aff';
        }
        else if (log.action === "insert") {
            renderTable();
            setTimeout(() => {
                const node = document.querySelector(`g[data-val="${log.keyVal}"]`);
                if(node) node.querySelector('rect').style.stroke = '#34c759';
            }, 50);
        }
        else if (log.action === "duplicate") {
             const node = document.querySelector(`g[data-val="${log.keyVal}"]`);
             if(node) node.classList.add('error-node');
        }
        else if (log.action === "found") {
             const node = document.querySelector(`g[data-val="${log.keyVal}"]`);
             if(node) node.classList.add('found-node');
        }

        i++;
        setTimeout(step, 600);
    }
    step();
}