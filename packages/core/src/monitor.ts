import type { PipelineMonitor, PipelineReport, StageMetrics } from './types';
import { Logger } from './logger';

const logger = new Logger('Monitor');

/**
 * 日志监控器 — 将性能指标输出到 Logger
 *
 * 最简单的 PipelineMonitor 实现，
 * 将每个阶段的耗时和 token 使用量打印到 debug 日志。
 *
 * @example
 * ```ts
 * const monitor = new LoggingMonitor()
 * const pipeline = new RAGPipeline({ ..., monitor })
 * ```
 */
export class LoggingMonitor implements PipelineMonitor {
  /**
   * 阶段开始回调
   *
   * @param stage - 阶段名称
   */
  onStageStart(stage: string): void {
    logger.debug(`[monitor] 阶段开始: ${stage}`);
  }

  /**
   * 阶段结束回调
   *
   * @param stage - 阶段名称
   * @param metrics - 阶段性能指标
   */
  onStageEnd(stage: string, metrics: StageMetrics): void {
    const tokens = metrics.tokenCount !== undefined ? `, tokens=${metrics.tokenCount}` : '';
    const results = metrics.resultCount !== undefined ? `, results=${metrics.resultCount}` : '';
    logger.debug(
      `[monitor] 阶段结束: ${stage} (${metrics.durationMs.toFixed(1)}ms${tokens}${results})`,
    );
  }

  /**
   * 查询完成回调
   *
   * @param report - 完整性能报告
   */
  onQueryComplete(report: PipelineReport): void {
    const tokens = report.totalTokens !== undefined ? `, totalTokens=${report.totalTokens}` : '';
    logger.info(
      `[monitor] 查询完成: ${report.queryDurationMs.toFixed(1)}ms, ${report.stages.length} stages${tokens}`,
    );
  }
}

/**
 * 收集监控器 — 将性能指标收集到内存中
 *
 * 适合需要程序化访问性能数据的场景（如评测、报告生成）。
 *
 * @example
 * ```ts
 * const monitor = new CollectingMonitor()
 * const pipeline = new RAGPipeline({ ..., monitor })
 * await pipeline.query('...')
 * console.log(monitor.getReports()) // 获取所有报告
 * ```
 */
export class CollectingMonitor implements PipelineMonitor {
  private readonly reports: PipelineReport[] = [];
  private currentStages: StageMetrics[] = [];
  private queryStartTime = 0;

  /**
   * 阶段开始回调
   *
   * @param _stage - 阶段名称
   */
  onStageStart(_stage: string): void {
    // 收集模式下不需要在 start 时做任何
  }

  /**
   * 阶段结束回调
   *
   * @param _stage - 阶段名称
   * @param metrics - 阶段性能指标
   */
  onStageEnd(_stage: string, metrics: StageMetrics): void {
    this.currentStages.push(metrics);
  }

  /**
   * 查询完成回调
   *
   * @param report - 完整性能报告
   */
  onQueryComplete(report: PipelineReport): void {
    this.reports.push(report);
  }

  /**
   * 获取所有收集到的性能报告
   *
   * @returns 性能报告列表
   */
  getReports(): PipelineReport[] {
    return [...this.reports];
  }

  /**
   * 获取最近一次查询的报告
   *
   * @returns 最近的性能报告，无记录时返回 undefined
   */
  getLastReport(): PipelineReport | undefined {
    return this.reports[this.reports.length - 1];
  }

  /**
   * 清空所有收集的报告
   */
  clear(): void {
    this.reports.length = 0;
  }
}
