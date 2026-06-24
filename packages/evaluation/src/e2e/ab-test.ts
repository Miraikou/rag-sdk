import type { ABTestEvent, ABTestReport } from '../types';

/** 默认置信水平 */
const DEFAULT_CONFIDENCE_LEVEL = 0.95;

/** 满意度计算权重 */
const WEIGHTS = {
  thumbsUp: 0.4,
  followUp: -0.3,
  sourceClick: 0.15,
  dwellTime: 0.15,
} as const;

/** 停留时间阈值（秒） */
const DWELL_TIME_THRESHOLD = 30;

/**
 * 标准正态分布累积分布函数（Abramowitz-Stegun 近似）
 *
 * @param x - 输入值
 * @returns 累积概率 P(Z <= x)
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp((-absX * absX) / 2);
  return 0.5 * (1.0 + sign * y);
}

/**
 * 计算单条事件的满意度得分
 *
 * 加权计算各信号：thumbsUp(+0.4)、followUp(-0.3)、sourceClick(+0.15)、
 * dwellTime > 30s(+0.15)，结果 clamp 到 [0, 1]。
 *
 * @param event - A/B 测试事件
 * @returns 满意度得分 [0, 1]
 */
function computeSatisfaction(event: ABTestEvent): number {
  let score = 0;

  if (event.thumbsUp) {
    score += WEIGHTS.thumbsUp;
  }
  if (event.followUp) {
    score += WEIGHTS.followUp;
  }
  if (event.sourceClick) {
    score += WEIGHTS.sourceClick;
  }
  if (event.dwellTime !== undefined && event.dwellTime > DWELL_TIME_THRESHOLD) {
    score += WEIGHTS.dwellTime;
  }

  // clamp 到 [0, 1]
  return Math.max(0, Math.min(1, score));
}

/**
 * 计算数组的均值
 *
 * @param values - 数值数组
 * @returns 均值
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * 计算数组的样本方差（Bessel 修正，÷n-1）
 *
 * @param values - 数值数组
 * @param avg - 均值
 * @returns 样本方差
 */
function variance(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  return values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1);
}

/**
 * A/B 测试分析器
 *
 * 收集 A/B 两组实验事件，基于加权满意度得分进行 Z-test 统计分析，
 * 判断两组之间是否存在显著差异并给出胜出方。
 */
export class ABTestAnalyzer {
  private readonly confidenceLevel: number;
  private readonly eventsA: ABTestEvent[] = [];
  private readonly eventsB: ABTestEvent[] = [];

  /**
   * @param confidenceLevel - 置信水平，默认 0.95
   */
  constructor(confidenceLevel: number = DEFAULT_CONFIDENCE_LEVEL) {
    this.confidenceLevel = confidenceLevel;
  }

  /**
   * 收集单条 A/B 测试事件
   *
   * @param event - A/B 测试事件
   */
  collectEvent(event: ABTestEvent): void {
    if (event.group === 'A') {
      this.eventsA.push(event);
    } else {
      this.eventsB.push(event);
    }
  }

  /**
   * 批量收集 A/B 测试事件
   *
   * @param events - A/B 测试事件列表
   */
  collectEvents(events: ABTestEvent[]): void {
    for (const event of events) {
      this.collectEvent(event);
    }
  }

  /**
   * 分析收集到的 A/B 测试数据，生成统计报告
   *
   * 使用 Z-test 检验两组满意度均值是否存在显著差异，
   * p-value 通过 Abramowitz-Stegun 正态 CDF 近似计算。
   * 当任一组样本数不足 2 时，返回无显著差异的保守结果。
   *
   * @returns A/B 测试分析报告
   */
  analyze(): ABTestReport {
    const countA = this.eventsA.length;
    const countB = this.eventsB.length;

    // 边界情况：任一组样本数不足 2
    if (countA < 2 || countB < 2) {
      return {
        satisfactionA: countA > 0 ? mean(this.eventsA.map(computeSatisfaction)) : 0,
        satisfactionB: countB > 0 ? mean(this.eventsB.map(computeSatisfaction)) : 0,
        countA,
        countB,
        zScore: 0,
        pValue: 1,
        significant: false,
        winner: 'tie',
      };
    }

    // 计算各组满意度得分
    const scoresA = this.eventsA.map(computeSatisfaction);
    const scoresB = this.eventsB.map(computeSatisfaction);

    const meanA = mean(scoresA);
    const meanB = mean(scoresB);
    const varA = variance(scoresA, meanA);
    const varB = variance(scoresB, meanB);

    // Z-test 统计量
    const denominator = Math.sqrt(varA / countA + varB / countB);
    const zScore = denominator > 0 ? (meanA - meanB) / denominator : 0;

    // 双尾 p-value
    const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));

    // 显著性判断
    const alpha = 1 - this.confidenceLevel;
    const significant = pValue < alpha;

    // 确定胜出方
    let winner: 'A' | 'B' | 'tie';
    if (significant) {
      winner = meanA > meanB ? 'A' : 'B';
    } else {
      winner = 'tie';
    }

    return {
      satisfactionA: meanA,
      satisfactionB: meanB,
      countA,
      countB,
      zScore,
      pValue,
      significant,
      winner,
    };
  }
}
