import { describe, it, expect } from 'vitest';
import { CollectingMonitor, LoggingMonitor } from '../src/monitor';
import type { PipelineReport, StageMetrics } from '../src/types';

describe('LoggingMonitor', () => {
  it('实现 PipelineMonitor 接口的三个方法', () => {
    const monitor = new LoggingMonitor();

    expect(typeof monitor.onStageStart).toBe('function');
    expect(typeof monitor.onStageEnd).toBe('function');
    expect(typeof monitor.onQueryComplete).toBe('function');
  });

  it('调用不抛出异常', () => {
    const monitor = new LoggingMonitor();
    const metrics: StageMetrics = { stage: 'test', durationMs: 100 };
    const report: PipelineReport = { queryDurationMs: 500, stages: [metrics] };

    expect(() => monitor.onStageStart('test')).not.toThrow();
    expect(() => monitor.onStageEnd('test', metrics)).not.toThrow();
    expect(() => monitor.onQueryComplete(report)).not.toThrow();
  });
});

describe('CollectingMonitor', () => {
  it('收集性能报告', () => {
    const monitor = new CollectingMonitor();
    const report: PipelineReport = {
      queryDurationMs: 500,
      stages: [{ stage: 'retrieve', durationMs: 200, resultCount: 10 }],
    };

    monitor.onQueryComplete(report);

    expect(monitor.getReports().length).toBe(1);
    expect(monitor.getReports()[0]!.queryDurationMs).toBe(500);
  });

  it('获取最近的报告', () => {
    const monitor = new CollectingMonitor();

    monitor.onQueryComplete({ queryDurationMs: 100, stages: [] });
    monitor.onQueryComplete({ queryDurationMs: 200, stages: [] });

    expect(monitor.getLastReport()!.queryDurationMs).toBe(200);
  });

  it('清空报告', () => {
    const monitor = new CollectingMonitor();

    monitor.onQueryComplete({ queryDurationMs: 100, stages: [] });
    monitor.clear();

    expect(monitor.getReports().length).toBe(0);
    expect(monitor.getLastReport()).toBeUndefined();
  });

  it('收集阶段指标', () => {
    const monitor = new CollectingMonitor();
    const metrics: StageMetrics = { stage: 'generate', durationMs: 300 };

    monitor.onStageEnd('generate', metrics);
    monitor.onQueryComplete({ queryDurationMs: 300, stages: [metrics] });

    const report = monitor.getLastReport()!;
    expect(report.stages.length).toBe(1);
    expect(report.stages[0]!.stage).toBe('generate');
  });
});
