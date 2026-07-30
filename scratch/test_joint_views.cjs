const joint = require('@joint/core');

console.log('joint.shapes keys:', Object.keys(joint.shapes));
console.log('joint.shapes.standard keys:', joint.shapes.standard ? Object.keys(joint.shapes.standard) : 'NONE');

const graph = new joint.dia.Graph({}, { cellNamespace: joint.shapes });
const paper = new joint.dia.Paper({
  el: null,
  model: graph,
  width: 800,
  height: 600,
  cellViewNamespace: joint.shapes,
});

const rect = new joint.shapes.standard.Rectangle({
  id: 'test-node-1',
  position: { x: 100, y: 100 },
  size: { width: 200, height: 120 },
});

graph.addCell(rect);

console.log('Graph cells count:', graph.getCells().length);
console.log('Paper views count:', Object.keys(paper._views || {}).length);
console.log('Paper findViewByModel:', !!paper.findViewByModel(rect));
