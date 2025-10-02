import { Table, Tag } from 'antd'

function PaymentsPage() {
  const columns = [
    {
      title: 'Payment ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'Loan ID',
      dataIndex: 'loan_id',
      key: 'loan_id',
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => `Rp ${amount.toLocaleString()}`,
    },
    {
      title: 'Method',
      dataIndex: 'payment_method',
      key: 'payment_method',
      render: (method: string) => <Tag>{method}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          pending: 'orange',
          success: 'green',
          failed: 'red',
        }
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>
      },
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
    },
  ]

  const mockData = [
    {
      key: '1',
      id: 'PAY001',
      loan_id: 'LOAN001',
      amount: 5500000,
      payment_method: 'bank_transfer',
      status: 'success',
      created_at: '2025-10-01 10:30',
    },
  ]

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Payments Management</h1>
      <Table columns={columns} dataSource={mockData} />
    </div>
  )
}

export default PaymentsPage
