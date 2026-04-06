<script>
  import { onMount, onDestroy } from 'svelte';
  import * as echarts from 'echarts';

  /** @type {import('echarts').EChartsOption} */
  export let option = {};
  export let height = '400px';
  export let on = {}; // { eventName: handler }
  export let onChartReady = null; // (chart) => void

  let container;
  let chart;
  let handlerEntries = [];

  function normalizeGraphicElements(graphic) {
    if (!chart || !Array.isArray(graphic)) return graphic;

    return graphic.map((element) => {
      if (!element || !Array.isArray(element.dataCoord)) return element;

      const [x, y] = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, element.dataCoord);
      const nextElement = { ...element };
      delete nextElement.dataCoord;
      nextElement.x = x + (element.offsetX ?? 0);
      nextElement.y = y + (element.offsetY ?? 0);
      delete nextElement.offsetX;
      delete nextElement.offsetY;
      return nextElement;
    });
  }

  function normalizeOption(nextOption) {
    if (!nextOption || typeof nextOption !== 'object') return nextOption;
    if (!Array.isArray(nextOption.graphic)) return nextOption;
    return {
      ...nextOption,
      graphic: normalizeGraphicElements(nextOption.graphic)
    };
  }

  function attachHandlers() {
    if (!chart) return;
    // Remove old handlers first
    for (const [eventName, handler] of handlerEntries) {
      chart.off(eventName, handler);
    }
    handlerEntries = [];

    if (on && typeof on === 'object') {
      for (const [eventName, handler] of Object.entries(on)) {
        if (typeof handler === 'function') {
          chart.on(eventName, handler);
          handlerEntries.push([eventName, handler]);
        }
      }
    }
  }

  $: if (container && option && Object.keys(option).length) {
    try {
      if (!chart) {
        chart = echarts.init(container);
      }
      chart.setOption(normalizeOption(option), { notMerge: true });
      attachHandlers();
    } catch (e) {
      console.error('ECharts error:', e);
    }
  }

  onMount(() => {
    if (container && !chart) {
      chart = echarts.init(container);
      if (option && Object.keys(option).length) chart.setOption(normalizeOption(option), { notMerge: true });

      if (typeof onChartReady === 'function') {
        onChartReady(chart);
      }
    }
    window.addEventListener('resize', resize);
  });

  onDestroy(() => {
    window.removeEventListener('resize', resize);
    if (chart) chart.dispose();
  });

  function resize() {
    if (chart) {
      chart.resize();
      if (option && Object.keys(option).length) {
        chart.setOption(normalizeOption(option), { notMerge: true });
        attachHandlers();
      }
    }
  }
</script>

<div bind:this={container} class="chart-container echart-host" style="height: {height};"></div>
