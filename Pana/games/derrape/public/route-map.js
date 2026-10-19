// The circuit drawn flat: the garage preview and the race minimap.

// Sample a route's centerline and fit it into a canvas with a margin.
export function fitRoute(route, canvas, margin) {
  const N = 160;
  const raw = [];
  for (let i = 0; i < N; i++) raw.push(route.pointAt((i / N) * route.TOTAL));
  const minX = Math.min(...raw.map(p=>p.x)), maxX = Math.max(...raw.map(p=>p.x));
  const minZ = Math.min(...raw.map(p=>p.y)), maxZ = Math.max(...raw.map(p=>p.y));
  const scale = Math.min((canvas.width-margin*2)/(maxX-minX), (canvas.height-margin*2)/(maxZ-minZ));
  return raw.map(p=>[canvas.width/2+(p.x-(minX+maxX)/2)*scale,canvas.height/2+(p.y-(minZ+maxZ)/2)*scale]);
}

export function strokeRoute(ctx, pts, width) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.strokeStyle = '#0e0b24';
  ctx.lineWidth = width * 2;
  ctx.stroke();
  ctx.strokeStyle = '#f3e9d7';
  ctx.lineWidth = width;
  ctx.stroke();
}

// Garage preview of the selected circuit, with its start line.
export function drawTrackPreview(canvas, route) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  try {
    const pts = fitRoute(route, canvas, 28);
    strokeRoute(ctx, pts, 7);
    const [x, y] = pts[Math.floor((route.LINE ?? 0) / route.TOTAL * pts.length) % pts.length];
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#ffc629'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#0e0b24'; ctx.stroke();
  } catch { /* metadata without a centerline: keep the striped placeholder */ }
}

// The race minimap. The route is stroked once into an offscreen canvas; each
// frame copies it and adds the cars' dots.
export function createMinimap(canvas) {
  const ctx = canvas.getContext('2d');
  const base = document.createElement('canvas');
  let pts = [];
  return {
    build(route) {
      base.width = canvas.width; base.height = canvas.height;
      pts = fitRoute(route, canvas, 16);
      const b = base.getContext('2d');
      b.clearRect(0, 0, base.width, base.height);
      strokeRoute(b, pts, 4);
    },
    // progress(car) is 0–1 along the lap; cars carry def.color and isPlayer.
    draw(cars, progress, mirror) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!pts.length) return;
      if (mirror) ctx.setTransform(-1, 0, 0, 1, canvas.width, 0);
      ctx.drawImage(base, 0, 0);
      for (const c of cars) {
        const [x, y] = pts[Math.floor(progress(c) * pts.length) % pts.length];
        ctx.beginPath();
        ctx.arc(x, y, c.isPlayer ? 5.5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = c.def.color;
        ctx.fill();
        if (c.isPlayer) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#fff';
          ctx.stroke();
        }
      }
    },
  };
}
