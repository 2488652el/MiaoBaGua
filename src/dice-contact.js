import { ConvexPolyhedron, Vec3 } from 'cannon-es';

// cannon-es 0.20 clips against the first N faces sharing any vertex. On an
// octahedron that includes faces touching only a corner, so a contact point can
// end up outside the hull and create a large, false penetration impulse.
export class DiceConvexPolyhedron extends ConvexPolyhedron {
  constructor(options) {
    super(options);
    this.edgeNeighbors = this.faces.map((face, index) => face.map((a, edge) => {
      const b = face[(edge + 1) % face.length];
      return this.faces.findIndex((other, otherIndex) =>
        otherIndex !== index && other.includes(a) && other.includes(b));
    }));
  }

  clipFaceAgainstHull(separatingNormal, position, quaternion, incidentVertices, minDistance, maxDistance, result) {
    let witness = 0, alignment = Infinity;
    const normal = new Vec3();
    this.faceNormals.forEach((faceNormal, index) => {
      quaternion.vmult(faceNormal, normal);
      const dot = normal.dot(separatingNormal);
      if (dot < alignment) { alignment = dot; witness = index; }
    });

    let polygon = incidentVertices;
    for (const neighbor of this.edgeNeighbors[witness]) {
      quaternion.vmult(this.faceNormals[neighbor], normal);
      const plane = this.getPlaneConstantOfFace(neighbor) - normal.dot(position);
      const clipped = [];
      this.clipFaceAgainstPlane(polygon, clipped, normal, plane);
      polygon = clipped;
      if (!polygon.length) return;
    }

    const witnessNormal = quaternion.vmult(this.faceNormals[witness]);
    const plane = this.getPlaneConstantOfFace(witness) - witnessNormal.dot(position);
    for (const point of polygon) {
      const depth = Math.max(minDistance, witnessNormal.dot(point) + plane);
      if (depth <= maxDistance && depth <= 1e-6) {
        result.push({ point, normal: witnessNormal, depth });
      }
    }
  }
}
