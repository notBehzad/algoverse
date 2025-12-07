const canvas = document.getElementById('bgCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

class Particle {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.5; // Slow, floaty movement
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = Math.random() * 2 + 1;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fill();
    }
}

// Initialize
for (let i = 0; i < 80; i++) {
    particles.push(new Particle());
}

// Mouse Interaction
let mouse = { x: null, y: null };
window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

// Animation Loop
function animate() {
    ctx.clearRect(0, 0, width, height);
    
    particles.forEach(p => {
        p.update();
        p.draw();
        
        // Connect to Mouse (The "Crazy" Interaction)
        const distMouse = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (distMouse < 150) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0, 122, 255, ${1 - distMouse/150})`;
            ctx.lineWidth = 1;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
        }

        // Connect to Neighbors (The Constellation)
        particles.forEach(p2 => {
            const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
            if (dist < 100) {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 * (1 - dist/100)})`;
                ctx.lineWidth = 0.5;
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        });
    });

    requestAnimationFrame(animate);
}
animate();

// ... (Keep your Canvas/Particle code above) ...

// --- 3. Graceful Page Transition Logic ---

// Select all links that point to other pages
const links = document.querySelectorAll('.card');

links.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault(); // Stop immediate hard-reload
        const targetUrl = link.getAttribute('href');

        // Add the exit class to trigger CSS animation
        document.body.classList.add('exiting');

        // Wait for animation to finish (500ms matches css time)
        setTimeout(() => {
            window.location.href = targetUrl;
        }, 500);
    });
});