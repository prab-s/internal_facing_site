import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import * as echarts from 'echarts';
import sharp from 'sharp';

import { LIGHT_CHART_THEME } from '../src/lib/chartTheme.js';
import { buildFullChartOption } from '../src/lib/fullChart.js';

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
    title: payload.title ?? 'Product Graph',
    graphConfig: payload.graphConfig ?? null,
    showRpmBandShading: payload.showRpmBandShading ?? true,
    clipRpmAreaToPermissibleUse: true,
    showSecondaryAxis: false,
    tooltip: { show: false },
    graphStyle: payload.graphStyle ?? null
  });

  option.animation = false;
  const outputBackground = option.backgroundColor || LIGHT_CHART_THEME.background;

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
    .flatten({ background: outputBackground })
    .png()
    .toFile(outputPath);
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
