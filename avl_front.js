let avl = null;
const svgNs = "http://www.w3.org/2000/svg";
let isAnimating = false;
let currentNodesData = []; // Store tree structure for hover lookups

Module.onRuntimeInitialized = function() {
    avl = new Module.AVLBackend();
    console.log("AVL WASM Ready");
    
    redrawTree();
};

// --- Handlers ---
function handleInsert() {
    if(isAnimating) return;
    const val = parseInt(document.getElementById('valInput').value);
    if(isNaN(val)) return;
    
    // 1. Get logs for animation
    const logs = avl.insert(val);
    
    // 2. Animate logs, then redraw final tree
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

// --- Animation Engine ---
function animateSequence(logs) {
    isAnimating = true;
    let i = 0;
    const focusRing = document.getElementById('focusRing');
    const statusDiv = document.getElementById('statusBar');
    
    // We need current positions to animate the "travel"
    // We'll rely on the node IDs (keys) present in the DOM
    
    function step() {
        if(i >= logs.size()) {
            isAnimating = false;
            focusRing.setAttribute('opacity', '0');
            statusDiv.innerText = "Operation Complete.";
            redrawTree(); // Snap to final perfect layout
            return;
        }

        const log = logs.get(i);
        statusDiv.innerText = log.action + ": " + log.info;

        if (log.action === 'search_visit') {
            // Move focus ring to this node
            const nodeGroup = document.getElementById(`node-${log.key}`);
            if(nodeGroup) {
                // Get transform coords
                const transform = nodeGroup.getAttribute('transform'); 
                // extract "translate(x, y)"
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
            // Optional: Flash the screen or node slightly
        }

        i++;
        // 500ms delay between steps for smooth "travel" look
        setTimeout(step, 500);
    }
    step();
}

// --- Tree Layout & Rendering ---

function redrawTree() {
    // 1. Fetch raw data from C++
    const rawData = avl.getTreeStructure(); // VectorNodeData
    currentNodesData = []; // Clear local cache
    
    // Convert Emscripten vector to JS Array
    let nodeMap = {};
    let rootId = -1;
    
    for(let i=0; i<rawData.size(); i++) {
        let n = rawData.get(i);
        // We need to copy the object, otherwise referencing deleted memory later
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

    // Find root (node that is not a child of anyone)
    // Actually, tree traversal is easier if we just rebuild hierarchy from the map
    // But since `getTreeStructure` is a flattened preorder (root first usually), 
    // the first element is root. If empty, clear.
    
    const nodesLayer = document.getElementById('nodesLayer');
    const edgesLayer = document.getElementById('edgesLayer');
    nodesLayer.innerHTML = '';
    edgesLayer.innerHTML = '';
    
    if (currentNodesData.length === 0) return;

    // 2. Compute Layout (Recursive)
    // Basic idea: Root at width/2. Children split remaining width.
    const canvasWidth = document.getElementById('treeSvg').clientWidth;
    const startY = 60;
    const levelHeight = 70;

    // Helper to draw
    function drawNodeRecursive(nodeKey, x, y, offsetX) {
        if(nodeKey === -1) return;
        
        const node = nodeMap[nodeKey];
        
        // Save computed coords for animations later
        node.x = x; 
        node.y = y;

        // Draw Left
        if (node.left !== -1) {
            drawEdge(x, y, x - offsetX, y + levelHeight);
            drawNodeRecursive(node.left, x - offsetX, y + levelHeight, offsetX / 2);
        }
        // Draw Right
        if (node.right !== -1) {
            drawEdge(x, y, x + offsetX, y + levelHeight);
            drawNodeRecursive(node.right, x + offsetX, y + levelHeight, offsetX / 2);
        }
        
        // Draw Self (after edges so nodes are on top)
        // We delay this slightly so edges appear first in DOM order? 
        // No, SVG z-index is defined by order. We'll append nodes after the recursive calls? 
        // Actually, we should draw edges in recursion, then append nodes in a second pass.
    }

    // First Pass: Edges and Coord calculation
    // Initial offset: width / 4
    if(currentNodesData.length > 0) {
        drawNodeRecursive(currentNodesData[0].key, canvasWidth / 2, startY, canvasWidth / 4);
    }

    // Second Pass: Draw Nodes (to be on top)
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
    // Add arrow
    // el.setAttribute("marker-end", "url(#arrowhead)");
    document.getElementById('edgesLayer').appendChild(el);
}

function drawNodeVisual(node) {
    const g = document.createElementNS(svgNs, "g");
    g.setAttribute("class", "node-group");
    g.setAttribute("transform", `translate(${node.x}, ${node.y})`);
    g.setAttribute("id", `node-${node.key}`);
    
    // Hover Events
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

// --- Tooltip Logic ---
const tooltip = document.getElementById('tooltip');

function showTooltip(evt, node) {
    // Get absolute position of the node in the viewport
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