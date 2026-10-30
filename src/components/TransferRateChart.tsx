import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { 
  sessionMetrics, 
  SessionMetricsState, 
  TransferSample, 
  formatBytes, 
  formatSpeed 
} from '../lib/sessionMetrics';
import { 
  Activity, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Zap, 
  Gauge, 
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';

interface TransferRateChartProps {
  compact?: boolean;
}

export const TransferRateChart: React.FC<TransferRateChartProps> = ({ compact = false }) => {
  const [metrics, setMetrics] = useState<SessionMetricsState>(sessionMetrics.getState());
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredSample, setHoveredSample] = useState<TransferSample | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const unsubscribe = sessionMetrics.subscribe((state) => {
      setMetrics(state);
    });
    return () => unsubscribe();
  }, []);

  // D3 Chart Drawing Effect
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    const bounds = containerRef.current.getBoundingClientRect();
    const width = bounds.width || (compact ? 360 : 640);
    const height = compact ? 160 : 260;
    const margin = { top: 20, right: 24, bottom: 32, left: compact ? 45 : 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const samples = metrics.samples;
    const now = Date.now();

    // Setup Scales
    const timeExtent = d3.extent(samples, (d: TransferSample) => new Date(d.timestamp));
    const timeDomain: [Date, Date] = [
      timeExtent[0] || new Date(now - 60000),
      timeExtent[1] || new Date(now)
    ];
    if (timeDomain[0].getTime() === timeDomain[1].getTime()) {
      timeDomain[0] = new Date(now - 60000);
      timeDomain[1] = new Date(now);
    }

    const xScale = d3
      .scaleTime()
      .domain(timeDomain)
      .range([0, innerWidth]);

    const maxObserved = d3.max(samples, (d: TransferSample) => d.rateBps);
    const maxRate = Math.max(1024 * 100, typeof maxObserved === 'number' ? maxObserved : 0);
    const yScale = d3
      .scaleLinear()
      .domain([0, maxRate * 1.15]) // 15% headroom
      .nice()
      .range([innerHeight, 0]);

    // Create Gradient
    const defs = svg.append('defs');
    const gradientId = `transfer-gradient-${Math.random().toString(36).substr(2, 9)}`;
    const linearGrad = defs
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    linearGrad
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#3b82f6')
      .attr('stop-opacity', 0.45);

    linearGrad
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#10b981')
      .attr('stop-opacity', 0.0);

    // Grid lines (horizontal)
    const yAxisTicks = yScale.ticks(compact ? 3 : 5);
    g.selectAll('.grid-line')
      .data(yAxisTicks)
      .enter()
      .append('line')
      .attr('class', 'grid-line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', 'rgba(156, 163, 175, 0.15)')
      .attr('stroke-dasharray', '3,3');

    // D3 Area Generator
    const areaGenerator = d3
      .area<TransferSample>()
      .curve(d3.curveMonotoneX)
      .x((d) => xScale(new Date(d.timestamp)))
      .y0(innerHeight)
      .y1((d) => yScale(d.rateBps));

    // D3 Line Generator
    const lineGenerator = d3
      .line<TransferSample>()
      .curve(d3.curveMonotoneX)
      .x((d) => xScale(new Date(d.timestamp)))
      .y((d) => yScale(d.rateBps));

    // Render Area
    g.append('path')
      .datum(samples)
      .attr('fill', `url(#${gradientId})`)
      .attr('d', areaGenerator);

    // Render Stroke Line
    g.append('path')
      .datum(samples)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', compact ? 2 : 2.5)
      .attr('stroke-linecap', 'round')
      .attr('d', lineGenerator);

    // Add Axes
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(compact ? 3 : 5)
      .tickFormat((d) => d3.timeFormat('%H:%M:%S')(d as Date));

    const yAxis = d3
      .axisLeft(yScale)
      .ticks(compact ? 3 : 5)
      .tickFormat((d) => formatSpeed(d as number));

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .call((axis) => axis.select('.domain').attr('stroke', 'rgba(156, 163, 175, 0.2)'))
      .call((axis) => axis.selectAll('.tick line').attr('stroke', 'rgba(156, 163, 175, 0.2)'))
      .call((axis) =>
        axis
          .selectAll('.tick text')
          .attr('fill', 'rgba(156, 163, 175, 0.8)')
          .attr('font-size', '10px')
      );

    g.append('g')
      .call(yAxis)
      .call((axis) => axis.select('.domain').remove())
      .call((axis) => axis.selectAll('.tick line').attr('stroke', 'rgba(156, 163, 175, 0.2)'))
      .call((axis) =>
        axis
          .selectAll('.tick text')
          .attr('fill', 'rgba(156, 163, 175, 0.8)')
          .attr('font-size', '10px')
      );

    // Latest active point indicator
    const latest = samples[samples.length - 1];
    if (latest) {
      const cx = xScale(new Date(latest.timestamp));
      const cy = yScale(latest.rateBps);

      g.append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', 4)
        .attr('fill', '#3b82f6')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2);

      if (latest.rateBps > 0) {
        g.append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', 8)
          .attr('fill', 'none')
          .attr('stroke', '#60a5fa')
          .attr('stroke-width', 1.5)
          .attr('opacity', 0.8);
      }
    }

    // Hover overlay for tooltips
    const bisectTime = d3.bisector<TransferSample, Date>((d) => new Date(d.timestamp)).center;

    svg
      .append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent')
      .on('mousemove touchmove', function (event) {
        const [mx] = d3.pointer(event, this);
        const relX = mx - margin.left;
        if (relX < 0 || relX > innerWidth) {
          setHoveredSample(null);
          setHoverPos(null);
          return;
        }

        const dateAtPointer = xScale.invert(relX);
        const index = bisectTime(samples, dateAtPointer);
        const sample = samples[index];
        if (sample) {
          setHoveredSample(sample);
          const sampleX = xScale(new Date(sample.timestamp)) + margin.left;
          const sampleY = yScale(sample.rateBps) + margin.top;
          setHoverPos({ x: sampleX, y: sampleY });
        }
      })
      .on('mouseleave touchend', () => {
        setHoveredSample(null);
        setHoverPos(null);
      });
  }, [metrics.samples, compact]);

  return (
    <div className="w-full">
      {/* Metric Cards Overview */}
      <div className={`grid ${compact ? 'grid-cols-2 gap-2 mb-3' : 'grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6'}`}>
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-3 sm:p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider">Total Transferred</span>
            <Activity className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {formatBytes(metrics.totalBytesTransferred)}
          </div>
          <div className="text-[10px] text-gray-400 mt-1 flex items-center space-x-1">
            <span>Sent: {formatBytes(metrics.totalBytesSent)}</span>
            <span>•</span>
            <span>Recv: {formatBytes(metrics.totalBytesReceived)}</span>
          </div>
        </div>

        <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-3 sm:p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider">Current Rate</span>
            <Gauge className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight">
            {formatSpeed(metrics.currentSpeedBps)}
          </div>
          <div className="text-[10px] text-gray-400 mt-1 flex items-center space-x-1">
            <span className={metrics.isActive ? 'text-emerald-400 font-bold' : ''}>
              {metrics.isActive ? 'Active Transfer' : 'Idle'}
            </span>
          </div>
        </div>

        {!compact && (
          <>
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-3 sm:p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
                <span className="font-semibold uppercase tracking-wider">Peak Rate</span>
                <Zap className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {formatSpeed(metrics.peakSpeedBps)}
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                Maximum observed speed
              </div>
            </div>

            <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-3 sm:p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
                <span className="font-semibold uppercase tracking-wider">Average Rate</span>
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {formatSpeed(metrics.averageSpeedBps)}
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                Across current session
              </div>
            </div>
          </>
        )}
      </div>

      {/* D3 SVG Container */}
      <div 
        ref={containerRef} 
        className="relative bg-gray-900/60 border border-gray-800 rounded-3xl p-4 overflow-hidden shadow-inner"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">
              Live Transfer Rate (D3 Visualizer)
            </span>
          </div>
          <button
            onClick={() => sessionMetrics.reset()}
            title="Reset Session Metrics"
            className="text-xs text-gray-400 hover:text-white flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-gray-800/60 hover:bg-gray-800 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        <svg 
          ref={svgRef} 
          className="w-full overflow-visible" 
          style={{ height: compact ? 160 : 260 }}
        />

        {/* Hover Crosshair / Tooltip */}
        {hoveredSample && hoverPos && (
          <div
            className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 bg-gray-950/95 border border-blue-500/40 rounded-xl px-3 py-2 text-xs shadow-2xl backdrop-blur-md z-10 whitespace-nowrap text-left"
            style={{ left: hoverPos.x, top: hoverPos.y }}
          >
            <div className="text-blue-400 font-bold mb-0.5">
              {formatSpeed(hoveredSample.rateBps)}
            </div>
            <div className="text-gray-300 text-[10px]">
              {new Date(hoveredSample.timestamp).toLocaleTimeString()}
            </div>
            <div className="text-gray-400 text-[10px]">
              Cumulative: {formatBytes(hoveredSample.cumulativeBytes)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
