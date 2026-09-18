import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from 'svelte/compiler';
import { simplifyCurve, createGraphReference, moveOverlayPoint } from '../src/lib/graphImport.js';
import { buildFullChartOption, buildSmoothedCurveSamples } from '../src/lib/fullChart.js';
import { LIGHT_CHART_THEME } from '../src/lib/chartTheme.js';

const source = fs.readFileSync(new URL('../src/lib/editor/ProductWorkspace.svelte', import.meta.url), 'utf8');
const functions = parse(source).instance.content.body.filter(n => n.type === 'FunctionDeclaration');
function editor() {
  const names = ['normalizeGraphCsvCell', 'normalizeGraphCsvHeader', 'normalizeGraphCsvRows',
    'parseGraphCsvNumber', 'parseGraphCsvInteger', 'parseGraphCsvLineToken', 'formatGraphCsvLineToken',
    'normalizeGraphCsvDownsampleCount', 'buildImportedGraphState', 'downsampleGraphCsvSeries',
    'downsampleGraphCsvOverlayPoints', 'interpolateGraphCsvValue', 'pressureAtAirflow',
    'applyLineByLineOverlayScaling', 'currentGraphState', 'applyGraphOptions'];
  const code = functions.filter(n => names.includes(n.id.name)).map(n => source.slice(n.start, n.end)).join('\n');
  return new Function('simplifyCurve', 'createGraphReference', 'buildSmoothedCurveSamples', `
    let id = 0, selectedProductId = 1, rpmLines = [], rpmPoints = [], efficiencyPoints = [];
    let graphCsvDownsampleImportedCurves = false, graphCsvDownsamplePointCount = 5;
    let graphCsvAutoScaleOverlays = false, graphCsvUseLowerEfficiencyLine = false;
    let graphCsvImportSignature = '', graphCsvError = '', productForm = { permissible_use_mode: 'both' };
    const graphReference = createGraphReference();
    const createTempPointId = () => --id, createTempRpmLineId = () => --id;
    const productSupportsGraphOverlays = () => true, normalizeOptionalColor = x => x;
    const parseOptionalNumber = x => x == null || x === '' ? null : Number(x);
    const RPM_BAND_FALLBACK_COLORS = ['#123456'];
    const applyRpmPointSort = points => points;
    ${code}
    return {
      load(rows) {
        const state = buildImportedGraphState(normalizeGraphCsvRows(rows), {permissibleUseMode:'both'});
        ({rpmLines, rpmPoints, efficiencyPoints} = state);
        graphReference.reset(state); return state;
      },
      options({reduce=false, count=5, scale=false}={}) {
        graphCsvDownsampleImportedCurves=reduce; graphCsvDownsamplePointCount=count;
        graphCsvAutoScaleOverlays=scale; applyGraphOptions(Math.random().toString());
        if(graphCsvError) throw new Error(graphCsvError);
        return currentGraphState();
      },
      edit(index, pressure) {rpmPoints[index].pressure=pressure;},
      scaleRaw: applyLineByLineOverlayScaling,
      state:currentGraphState
    };
  `)(simplifyCurve, createGraphReference, buildSmoothedCurveSamples);
}
const rows = () => [['airflow_l_s', 'pressure_1000rpm', 'efficiency_centre'],
  ...Array.from({length:101}, (_,i) => [i*10+0.1, 500-3*i+0.25, i<=20 ? i*5+0.125 : ''])];

test('import and option previews retain decimals, all points, and reversible transformations', () => {
  const e = editor(), original = structuredClone(e.load(rows()));
  assert.equal(original.rpmPoints.length, 101);
  assert.equal(original.rpmPoints[0].airflow, 0.1);
  assert.equal(original.rpmPoints[0].pressure, 500.25);
  assert.equal(e.options({reduce:true}).rpmPoints.length, 5);
  assert.equal(e.options({reduce:true,count:15}).rpmPoints.length, 15);
  assert.deepEqual(e.options(), original);
  const scaled = structuredClone(e.options({scale:true}));
  assert.notDeepEqual(scaled.efficiencyPoints, original.efficiencyPoints);
  assert.deepEqual(e.options({scale:true}), scaled);
  assert.deepEqual(e.options(), original);
});

test('manual adjustments become reference; a reimport resets it', () => {
  const e = editor(); e.load(rows()); e.edit(50,123.456);
  const edited = structuredClone(e.state());
  e.options({reduce:true,count:15,scale:true});
  assert.deepEqual(e.options(), edited);
  e.load(rows());
  assert.notEqual(e.state().rpmPoints[50].pressure,123.456);
});

test('missing values stay missing; malformed formatted numbers are rejected', () => {
  const e=editor();
  const state=e.load([['airflow_l_s','pressure_1000rpm'],[100,'#N/A'],[200,300.75]]);
  assert.equal(state.rpmPoints.length,1);
  assert.equal(state.rpmPoints[0].airflow,200);
  assert.throws(()=>e.load([['airflow_l_s','pressure_1000rpm'],[0,'1,200']]),/non-numeric/);
  assert.throws(()=>e.options({reduce:true,count:1}),/at least 2/);
  assert.throws(()=>e.options({reduce:true,count:2.5}),/whole number/);
});

test('simplification keeps narrow dip, endpoints and original values', () => {
  const points=Array.from({length:101},(_,i)=>({airflow:i*10,pressure:500-3*i-(i===36?150:0)}));
  const result=simplifyCurve(points,'airflow','pressure',5);
  assert.ok(result.includes(points[36]));
  assert.equal(result[0],points[0]); assert.equal(result.at(-1),points.at(-1));
  assert.ok(result.every(p=>points.includes(p)));
});

test('editor and viewer share RPM contours and band polygons', () => {
  const e=editor(); const state=e.load(rows());
  const options={...state,chartTheme:LIGHT_CHART_THEME,clipRpmAreaToPermissibleUse:true};
  const view=buildFullChartOption({...options,includeDragHandles:false});
  const edit=buildFullChartOption({...options,includeDragHandles:true});
  const rpmLine=option=>option.series.find(s=>s.type==='line' && s.name.includes('1000'));
  assert.deepEqual(rpmLine(edit).data,rpmLine(view).data);
  const bands=option=>option.series.filter(s=>s.name?.includes(' band'))
    .map(s=>({name:s.name, polygons:s.data.map((_,dataIndex)=>s.renderItem({dataIndex},{coord:p=>p}))}));
  assert.ok(bands(edit).length > 0);
  assert.deepEqual(bands(edit),bands(view));
  assert.ok(edit.series.some(s=>s.type==='scatter' && s.data.length===101));
});

test('dense curve rendering has bounded extra sampling', () => {
  const e=editor(); const state=e.load(rows());
  state.rpmPoints=Array.from({length:10000},(_,i)=>({...state.rpmPoints[0],id:i,airflow:i/10,pressure:500-i/30}));
  const start=performance.now();
  const result=buildFullChartOption({...state,chartTheme:LIGHT_CHART_THEME,includeDragHandles:true});
  const line=result.series.find(s=>s.type==='line' && s.name.includes('1000'));
  assert.equal(line.data.length,10000);
  console.log('10,000-point chart option build:',Math.round(performance.now()-start),'ms');
});

 test('moving one overlay leaves other shared-row coordinates unchanged', () => {
  const points=[{id:1,airflow:100,efficiency_centre:50,efficiency_lower_end:25}];
  const moved=moveOverlayPoint(points,1,'efficiency_centre',150,60,()=>2);
  assert.equal(moved.find(p=>p.id===1).efficiency_lower_end,null);
  assert.equal(moved.find(p=>p.id===2).airflow,100);
  assert.equal(moved.find(p=>p.id===2).efficiency_lower_end,25);
  assert.equal(points[0].airflow,100);
});

test('all permissible-use modes keep editor and viewer shaded boundaries identical', () => {
  const e=editor(); const state=e.load(rows());
  state.efficiencyPoints=[
    {id:1,airflow:100,efficiency_lower_end:50,efficiency_higher_end:100,permissible_use:90},
    {id:2,airflow:400,efficiency_lower_end:150,efficiency_higher_end:350,permissible_use:300},
    {id:3,airflow:800,efficiency_lower_end:300,efficiency_higher_end:450,permissible_use:400},
  ];
  for (const permissibleUseMode of ['dedicated','upper','lower','both','none']) {
    const options={...state,chartTheme:LIGHT_CHART_THEME,clipRpmAreaToPermissibleUse:true,permissibleUseMode};
    const view=buildFullChartOption({...options,includeDragHandles:false});
    const edit=buildFullChartOption({...options,includeDragHandles:true});
    const shapes=option=>option.series.filter(s=>s.name?.includes(' band'))
      .map(s=>s.data.map((_,dataIndex)=>s.renderItem({dataIndex},{coord:p=>p})));
    assert.ok(shapes(edit).length);
    assert.deepEqual(shapes(edit),shapes(view));
    for(const line of edit.series.filter(s=>s.type==='line' && /Efficiency|Permissible/.test(s.name))) {
      assert.deepEqual(line.data,view.series.find(s=>s.name===line.name).data);
      assert.equal(line.smooth,false);
    }
  }
});

test('automatic alignment meets the displayed RPM curve after simplification', () => {
  const e=editor();
  const input=[['airflow_l_s','pressure_1000rpm','efficiency_centre'],
    ...Array.from({length:101},(_,i)=>[i*10,500-i*i/30,i<=36?i+1:''])];
  e.load(input);
  const state=e.options({reduce:true,count:5,scale:true});
  const curve=buildSmoothedCurveSamples(state.rpmPoints.map(p=>[p.airflow,p.pressure]));
  const peak=state.efficiencyPoints.reduce((a,b)=>a.efficiency_centre>b.efficiency_centre?a:b);
  const right=curve.findIndex(([x])=>x>=peak.airflow);
  const [x0,y0]=curve[Math.max(0,right-1)], [x1,y1]=curve[right];
  const target=x0===x1?y1:y0+(y1-y0)*(peak.airflow-x0)/(x1-x0);
  assert.ok(Math.abs(peak.efficiency_centre-target)<1e-9);
});

test('editing a simplified preview makes that edited draft the new baseline', () => {
  const e=editor(); e.load(rows()); e.options({reduce:true,count:15});
  e.edit(3,123.456);
  const edited=structuredClone(e.state());
  e.options({reduce:true,count:5});
  assert.deepEqual(e.options(),edited);
});

 test('bulk and editor imports agree on simplification and displayed-curve alignment', () => {
  const input=[['airflow_l_s','pressure_1000rpm','efficiency_centre'],
    ...Array.from({length:101},(_,i)=>[i*10+.1,500-i*i/30,i<=36?i+.125:''])];
  const e=editor(); e.load(input);
  const front=e.options({reduce:true,count:15,scale:true});
  const rows=input.slice(1).map(row=>Object.fromEntries(input[0].map((key,i)=>[key,row[i]])));
  const back=JSON.parse(execFileSync('python3',['-c',
    'import json,sys; from backend.main import bulk_import_build_graph_state; print(json.dumps(bulk_import_build_graph_state(json.load(sys.stdin), downsample_imported_curves=True, downsample_point_count=15, auto_scale_overlays=True)))'],
    {input:JSON.stringify(rows),cwd:new URL('../../',import.meta.url),encoding:'utf8'}));
  assert.deepEqual(front.rpmPoints.map(p=>[p.airflow,p.pressure]),back.rpmPoints.map(p=>[p.airflow,p.pressure]));
  assert.equal(front.efficiencyPoints.length,back.efficiencyPoints.length);
  front.efficiencyPoints.forEach((point,i)=>{
    assert.equal(point.airflow,back.efficiencyPoints[i].airflow);
    assert.ok(Math.abs(point.efficiency_centre-back.efficiencyPoints[i].efficiency_centre)<1e-9);
  });
});

test('numeric strings from edited table cells render at the same coordinates', () => {
  const e=editor(); const state=e.load(rows());
  const options={...state,chartTheme:LIGHT_CHART_THEME,includeDragHandles:true};
  const numeric=buildFullChartOption(options);
  const strings=buildFullChartOption({...options,rpmPoints:state.rpmPoints.map(p=>({...p,airflow:String(p.airflow),pressure:String(p.pressure)}))});
  const line=option=>option.series.find(s=>s.type==='line' && s.name.includes('1000'));
  assert.deepEqual(line(strings).data,line(numeric).data);
});

test('alignment skips an empty higher-RPM line', () => {
  const e = editor();
  const source = [{ airflow: 5, efficiency_centre: 10 }];
  const lines = [{ id: 1, rpm: 1000 }, { id: 2, rpm: 2000 }];
  const points = [
    { rpm_line_id: 1, airflow: 0, pressure: 100 },
    { rpm_line_id: 1, airflow: 10, pressure: 0 },
  ];
  const scaled = e.scaleRaw(source, lines, points);
  assert.equal(scaled[0].efficiency_centre, 50);
  assert.deepEqual(source, [{ airflow: 5, efficiency_centre: 10 }]);
});
