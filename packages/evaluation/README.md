# @ragsdk/evaluation

评测模块，支持检索、生成与端到端评测。

## 安装

```bash
pnpm add @ragsdk/evaluation
```

## 主要功能

### 检索评测
- **Recall@K** — 召回率
- **Precision@K** — 精确率
- **MRR** — 平均倒数排名
- **NDCG** — 归一化折损累积增益

### 生成评测
- **BLEU** — 双语评估替换
- **ROUGE** — 召回导向重叠
- **BERTScore** — 基于 BERT 的语义相似度
- **Faithfulness** — 忠实度评估
- **Relevance** — 相关性评估

### 端到端评测
- **LLM-as-Judge** — LLM 评分
- **A/B Test** — A/B 对比测试

## 快速开始

```ts
import { Benchmark } from '@ragsdk/evaluation';

const benchmark = new Benchmark({ pipeline });
const report = await benchmark.run(testDataset);

console.log(report.metrics);
```

## 文档

完整文档请参考 [rag-sdk 主仓库](https://github.com/Miraikou/rag-sdk)。

## License

MIT
