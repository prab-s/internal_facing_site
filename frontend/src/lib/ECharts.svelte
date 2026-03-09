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
      chart.setOption(option, { notMerge: true });
      attachHandlers();
    } catch (e) {
      console.error('ECharts error:', e);
    }
  }

  onMount(() => {
    if (container && !chart) {
      chart = echarts.init(container);
      if (option && Object.keys(option).length) chart.setOption(option, { notMerge: true });

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
    if (chart) chart.resize();
  }
</script>

<div bind:this={container} class="chart-container" style="height: {height}; border: 1px solid red; background: white;"></div>
