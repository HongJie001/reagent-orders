// EXPORTS: IOrder, MOCK_ORDERS
export interface IOrder {
  id: string
  procurementDate: string
  procurementMethod: string
  status: '待处理' | '已采购' | '已调拨' | '已到货' | '已发货'
  orderForm: '线上' | '线下' | '后补单'
  customer: string
  brand: string
  catalogNumber: string
  productName: string
  specification: string
  listPrice: number
  quantity: number
  unitPrice: number
  totalPrice: number
  remarks: string
  arrivalTime?: string
  createdAt: string
  updatedAt: string
  source?: 'mock' | 'user'
}

export const MOCK_ORDERS: IOrder[] = [
  {
    id: '1',
    procurementDate: '2025-01-15',
    procurementMethod: '天河',
    status: '待处理',
    orderForm: '线上',
    customer: '中山大学实验室',
    brand: 'Sigma',
    catalogNumber: 'S7388',
    productName: '氯化钠',
    specification: '500g/瓶',
    listPrice: 580,
    quantity: 3,
    unitPrice: 520,
    totalPrice: 1560,
    remarks: '急需，本周内到货',
    arrivalTime: '',
    createdAt: '2025-01-15T08:30:00Z',
    updatedAt: '2025-01-15T08:30:00Z',
    source: 'mock'
  },
  {
    id: '2',
    procurementDate: '2025-01-14',
    procurementMethod: '天河',
    status: '已采购',
    orderForm: '线下',
    customer: '华南理工课题组',
    brand: 'Thermo',
    catalogNumber: 'T9283',
    productName: 'Tris缓冲液',
    specification: '1L/瓶',
    listPrice: 320,
    quantity: 5,
    unitPrice: 300,
    totalPrice: 1500,
    remarks: '',
    arrivalTime: '',
    createdAt: '2025-01-14T10:15:00Z',
    updatedAt: '2025-01-14T14:20:00Z',
    source: 'mock'
  },
  {
    id: '3',
    procurementDate: '2025-01-13',
    procurementMethod: '天河',
    status: '已调拨',
    orderForm: '后补单',
    customer: '暨南大学药学院',
    brand: 'Abcam',
    catalogNumber: 'A1101',
    productName: '抗体Anti-GAPDH',
    specification: '100μl/支',
    listPrice: 2800,
    quantity: 2,
    unitPrice: 2600,
    totalPrice: 5200,
    remarks: '需冷链运输',
    arrivalTime: '',
    createdAt: '2025-01-13T09:00:00Z',
    updatedAt: '2025-01-13T16:45:00Z',
    source: 'mock'
  }
]