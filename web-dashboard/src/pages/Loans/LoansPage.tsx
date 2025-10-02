import { Table, Tag, Button, Space } from 'antd'

function LoansPage() {
  const columns = [
    {
      title: 'Loan ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'User',
      dataIndex: 'user_name',
      key: 'user_name',
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => `Rp ${amount.toLocaleString()}`,
    },
    {
      title: 'Type',
      dataIndex: 'loan_type',
      key: 'loan_type',
      render: (type: string) => <Tag>{type}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          pending: 'orange',
          approved: 'blue',
          active: 'green',
          paid: 'cyan',
          rejected: 'red',
          default: 'volcano',
        }
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: () => (
        <Space>
          <Button type="link" size="small">View</Button>
          <Button type="link" size="small">Approve</Button>
        </Space>
      ),
    },
  ]

  const mockData = [
    {
      key: '1',
      id: 'LOAN001',
      user_name: 'John Doe',
      amount: 5000000,
      loan_type: 'conventional',
      status: 'pending',
    },
  ]

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Loans Management</h1>
      <Table columns={columns} dataSource={mockData} />
    </div>
  )
}

export default LoansPage
