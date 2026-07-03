// EXPORTS: ILogisticsNode, ILogisticsRecord, MOCK_LOGISTICS_MAP
export interface ILogisticsNode {
  time: string
  status: string
  location?: string
}

export interface ILogisticsRecord {
  trackingNumber: string
  nodes: ILogisticsNode[]
}

export const MOCK_LOGISTICS_MAP: Record<string, ILogisticsNode[]> = {
  'SF1234567890': [
    { time: '2025-01-15 09:30', status: '已揽收', location: '广州天河集散中心' },
    { time: '2025-01-15 14:20', status: '运输中', location: '广州番禺中转站' },
    { time: '2025-01-16 08:15', status: '派送中', location: '深圳南山营业点' },
  ],
  'YT9876543210': [
    { time: '2025-01-14 10:00', status: '已揽收', location: '上海浦东集散中心' },
    { time: '2025-01-14 18:30', status: '运输中', location: '上海虹桥中转站' },
    { time: '2025-01-15 07:45', status: '已签收', location: '杭州西湖区' },
  ],
  'DB2468013579': [
    { time: '2025-01-16 11:00', status: '已揽收', location: '北京朝阳集散中心' },
    { time: '2025-01-16 16:00', status: '运输中', location: '北京大兴中转站' },
  ],
}