import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import * as echarts from 'echarts';
import sharp from 'sharp';

import { buildFullChartOption } from '../src/lib/fullChart.js';

const LIGHT_CHART_THEME = {
  background: '#ffffff',
  text: '#1e293b',
  grid: '#d7dde8',
  accent: '#2563eb',
  efficiency: '#15803d',
  permissible: '#dc2626',
  neutralLine: '#6b7280',
  fontFamily: 'DejaVu Sans, Liberation Sans, Arial, sans-serif'
};

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const outputPath = process.argv[2];
  if (!outputPath) {
    throw new Error('Output path argument is required');
  }

  const input = await readStdin();
  const payload = JSON.parse(input);

  const option = buildFullChartOption({
    rpmLines: payload.rpmLines ?? [],
    rpmPoints: payload.rpmPoints ?? [],
    efficiencyPoints: payload.efficiencyPoints ?? [],
    chartTheme: LIGHT_CHART_THEME,
    title: payload.title ?? 'Fan Map',
    showRpmBandShading: payload.showRpmBandShading ?? true,
    clipRpmAreaToPermissibleUse: true,
    showSecondaryAxis: false,
    tooltip: { show: false }
  });

  option.animation = false;

  const width = 1600;
  const height = 960;
  const chart = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width,
    height,
  });

  chart.setOption(option, { notMerge: true, lazyUpdate: false });
  const svg = chart.renderToSVGString();
  chart.dispose();

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
