let cppGraph = null;
let isAnimating = false;

// State
let nodes = []; // {id, x, y}
let edges = []; // {u, v, weight}
const svgNs = "http://www.w3.org/2000/svg";

// --- Emscripten Init ---
Module.onRuntimeInitialized = function() {
    cppGraph = new Module.GraphBackend();
    console.log("WASM Loaded");
    
    // Default Graph
    addNodeLogic(1, 400, 100);
    addNodeLogic(2, 250, 300);
    addNodeLogic(3, 550, 300);
    addEdgeLogic(1, 2, 4);
    addEdgeLogic(1, 3, 2);
    addEdgeLogic(2, 3, 5);
};

// --- Logic Helpers ---
function addNodeLogic(id, x, y) {
    if(nodes.find(n => n.id == id)) return;
    nodes.push({ id: parseInt(id), x, y });
    cppGraph.addVertex(parseInt(id));
    renderGraph();
}

function addEdgeLogic(u, v, w) {
    u = parseInt(u); v = parseInt(v); w = parseInt(w);
    // Avoid duplicates (undirected)
    edges = edges.filter(e => !((e.u === u && e.v === v) || (e.u === v && e.v === u)));
    edges.push({ u, v, w });
    cppGraph.addEdge(u, v, w);
    renderGraph();
}

// --- UI Handlers ---
function handleAddNode() {
    const id = document.getElementById('nodeInput').value;
    if(!id) return;
    addNodeLogic(id, 400 + (Math.random()*50), 300 + (Math.random()*50));
}

function handleRemoveNode() {
    const id = parseInt(document.getElementById('nodeInput').value);
    nodes = nodes.filter(n => n.id !== id);
    edges = edges.filter(e => e.u !== id && e.v !== id);
    cppGraph.removeVertex(id);
    renderGraph();
}

function handleAddEdge() {
    const u = document.getElementById('uInput').value;
    const v = document.getElementById('vInput').value;
    const w = document.getElementById('wInput').value;
    if(u && v) addEdgeLogic(u, v, w);
}

// --- SVG Rendering Engine ---
function renderGraph() {
    const nodesLayer = document.getElementById('nodesLayer');
    const edgesLayer = document.getElementById('edgesLayer');
    
    // Clear current (inefficient but safe for beginner logic)
    nodesLayer.innerHTML = '';
    edgesLayer.innerHTML = '';

    // Draw Edges
    edges.forEach(e => {
        const n1 = nodes.find(n => n.id === e.u);
        const n2 = nodes.find(n => n.id === e.v);
        if(!n1 || !n2) return;

        const g = document.createElementNS(svgNs, "g");
        g.setAttribute("id", `edge-${e.u}-${e.v}`);
        
        // Line
        const line = document.createElementNS(svgNs, "line");
        line.setAttribute("x1", n1.x);
        line.setAttribute("y1", n1.y);
        line.setAttribute("x2", n2.x);
        line.setAttribute("y2", n2.y);
        line.setAttribute("class", "edge");
        
        // Weight Label
        const midX = (n1.x + n2.x) / 2;
        const midY = (n1.y + n2.y) / 2;
        
        const rect = document.createElementNS(svgNs, "rect");
        rect.setAttribute("x", midX - 10);
        rect.setAttribute("y", midY - 10);
        rect.setAttribute("width", 20);
        rect.setAttribute("height", 20);
        rect.setAttribute("class", "edge-weight-bg");

        const text = document.createElementNS(svgNs, "text");
        text.setAttribute("x", midX);
        text.setAttribute("y", midY);
        text.setAttribute("class", "edge-weight-text");
        text.textContent = e.w;

        g.appendChild(line);
        g.appendChild(rect);
        g.appendChild(text);
        edgesLayer.appendChild(g);
    });

    // Draw Nodes
    nodes.forEach(n => {
        const g = document.createElementNS(svgNs, "g");
        g.setAttribute("class", "node-group");
        g.setAttribute("transform", `translate(${n.x}, ${n.y})`);
        g.setAttribute("id", `node-${n.id}`);
        
        // Drag Events
        g.addEventListener('mousedown', (evt) => startDrag(evt, n));

        const circle = document.createElementNS(svgNs, "circle");
        circle.setAttribute("r", 25);
        circle.setAttribute("class", "node-circle");
        
        const text = document.createElementNS(svgNs, "text");
        text.setAttribute("class", "node-text");
        text.textContent = n.id;

        // Badge (Distance/Key) - Hidden initially
        const badgeG = document.createElementNS(svgNs, "g");
        badgeG.setAttribute("class", "node-badge");
        badgeG.setAttribute("transform", "translate(15, -25)");
        
        const bRect = document.createElementNS(svgNs, "rect");
        bRect.setAttribute("width", 50);
        bRect.setAttribute("height", 20);
        bRect.setAttribute("class", "node-badge-rect");
        
        const bText = document.createElementNS(svgNs, "text");
        bText.setAttribute("x", 25);
        bText.setAttribute("y", 10);
        bText.setAttribute("class", "node-badge-text");
        bText.textContent = "INF";

        badgeG.appendChild(bRect);
        badgeG.appendChild(bText);

        g.appendChild(circle);
        g.appendChild(text);
        g.appendChild(badgeG);
        nodesLayer.appendChild(g);
    });
}

// --- Dragging Logic ---
let dragNode = null;
function startDrag(evt, node) {
    dragNode = node;
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
}

function onDrag(evt) {
    if(!dragNode) return;
    const svg = document.getElementById('graphSvg');
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
    
    dragNode.x = svgP.x;
    dragNode.y = svgP.y;
    renderGraph(); // Re-render to update edge positions
}

function endDrag() {
    dragNode = null;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
}

// --- Animation Engine ---
function runAlgorithm() {
    if(isAnimating) return;
    
    // Reset Visuals
    document.querySelectorAll('.node-circle').forEach(el => el.style.fill = '#1c1c1e');
    document.querySelectorAll('.edge').forEach(el => { el.style.stroke = '#d1d1d6'; el.style.strokeWidth = 3; });
    document.getElementById('dsContainer').innerHTML = '<div class="ds-placeholder">Running...</div>';
    // Hide badges
    document.querySelectorAll('.node-badge').forEach(el => el.style.display = 'none');

    const algo = document.getElementById('algoSelect').value;
    const start = parseInt(document.getElementById('startNode').value);
    
    if(!nodes.find(n => n.id === start)) { alert("Invalid Start Node"); return; }

    let logs;
    if(algo === 'bfs') logs = cppGraph.runBFS(start);
    if(algo === 'dfs') logs = cppGraph.runDFS(start);
    if(algo === 'dijkstra') logs = cppGraph.runDijkstra(start);
    if(algo === 'prim') logs = cppGraph.runPrim(start);

    animate(logs);
}

function animate(logs) {
    isAnimating = true;
    const dsContainer = document.getElementById('dsContainer');
    dsContainer.innerHTML = ''; // Clear placeholder
    
    let i = 0;
    function step() {
        if(i >= logs.size()) {
            isAnimating = false;
            return;
        }

        const log = logs.get(i);
        
        // 1. Visit Animation
        if(log.action === 'visit') {
            const nodeEl = document.querySelector(`#node-${log.nodeA} .node-circle`);
            if(nodeEl) nodeEl.style.fill = '#34c759'; // Green success color
        }
        
        // 2. Queue/Stack Push
        else if(log.action === 'push') {
            const item = document.createElement('div');
            item.className = 'q-item';
            item.id = `q-item-${log.nodeA}`;
            item.innerText = log.info ? `${log.nodeA} [${log.info}]` : log.nodeA;
            dsContainer.appendChild(item);
            
            // Temporary highlight
            const nodeEl = document.querySelector(`#node-${log.nodeA} .node-circle`);
            if(nodeEl && nodeEl.style.fill !== 'rgb(52, 199, 89)') nodeEl.style.fill = '#555';
        }

        // 3. Queue/Stack Pop
        else if(log.action === 'pop') {
            // Find the visual item in the DS container
            // For Stack (DFS), we usually pop the last added. For Queue (BFS), the first.
            // Simplified logic: find the element by ID and remove it.
            // If multiples exist (re-added in Dijkstra), remove one.
            const items = document.querySelectorAll(`#q-item-${log.nodeA}`);
            if(items.length > 0) {
                const itemToRemove = items[0]; // Logic matches Queue, tweak for Stack if strictly needed visually
                itemToRemove.classList.add('popping');
                setTimeout(() => itemToRemove.remove(), 300);
            }
        }

        // 4. Update Distance/Key Badge
        else if(log.action === 'update_dist') {
            const badge = document.querySelector(`#node-${log.nodeA} .node-badge`);
            const badgeText = document.querySelector(`#node-${log.nodeA} .node-badge-text`);
            if(badge && badgeText) {
                badge.style.display = 'block';
                badgeText.textContent = log.info;
            }
        }

        // 5. Highlight Edge
        else if(log.action === 'highlight_edge') {
            // Try both directions
            let edgeGroup = document.getElementById(`edge-${log.nodeA}-${log.nodeB}`) || 
                            document.getElementById(`edge-${log.nodeB}-${log.nodeA}`);
            if(edgeGroup) {
                const line = edgeGroup.querySelector('line');
                line.style.stroke = '#007aff';
                line.style.strokeWidth = 6;
            }
        }

        i++;
        setTimeout(() => requestAnimationFrame(step), 700);
    }
    step();
}