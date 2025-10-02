import { Table, Tag } from 'antd'

function UsersPage() {
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: 'KYC Status',
      dataIndex: 'kyc_status',
      key: 'kyc_status',
      render: (status: string) => {
        const color = status === 'verified' ? 'green' : status === 'pending' ? 'orange' : 'default'
        return <Tag color={color}>{status}</Tag>
      },
    },
    {
      title: 'Credit Score',
      dataIndex: 'credit_score',
      key: 'credit_score',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const color = status === 'active' ? 'green' : status === 'suspended' ? 'red' : 'default'
        return <Tag color={color}>{status}</Tag>
      },
    },
  ]

  const mockData = [
    {
      key: '1',
      id: '1',
      name: 'John Doe',
      phone: '081234567890',
      kyc_status: 'verified',
      credit_score: 750,
      status: 'active',
    },
  ]

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Users Management</h1>
      <Table columns={columns} dataSource={mockData} />
    </div>
  )
}

export default UsersPage
