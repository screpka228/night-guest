// Круг радиуса r против центрированных прямоугольников {x, z, w, d}
export function isBlocked(colliders, x, z, r) {
  for (const c of colliders) {
    if (Math.abs(x - c.x) < c.w / 2 + r && Math.abs(z - c.z) < c.d / 2 + r) return true;
  }
  return false;
}
