import { useState } from 'react';
import { Eye, CheckCircle, Download } from 'lucide-react';
import DataTable from '../../components/shared/DataTable';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import StatCard from '../../components/shared/StatCard';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { paymentsAPI, earningsAPI } from '../../api/client';
import { DollarSign, AlertTriangle, Clock } from 'lucide-react';

const TX_COLS = [
  { key: 'transaction_id', label: 'Txn ID',   render: v => <strong style={{ fontSize: 12, color: 'var(--accent-primary)', fontFamily: 'monospace' }}>{v}</strong> },
  { key: 'customer_name',  label: 'Customer' },
  { key: 'driver_name',    label: 'Driver' },
  { key: 'ride_id',        label: 'Ride',     render: v => v ? <span style={{ color: 'var(--accent-primary)', fontSize: 12 }}>#{v}</span> : '—' },
  { key: 'amount',         label: 'Amount',   render: v => <strong>₹{v}</strong> },
  { key: 'payment_method', label: 'Method',   render: v => v ? <span className="badge badge-primary">{v}</span> : '—' },
  { key: 'gateway',        label: 'Gateway' },
  { key: 'status',         label: 'Status',   render: v => <StatusBadge status={v} /> },
  { key: 'created_at',     label: 'Date',     render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span> },
  { key: 'actions',        label: '',         render: (_, row) => (
    <div style={{ display: 'flex', gap: 5 }}>
      <button className="btn btn-sm btn-ghost"><Eye size={13} /></button>
      {row.status !== 'refunded' && row.status === 'completed' && (
        <button className="btn btn-sm btn-warning" onClick={() => paymentsAPI.refund(row.id)}>Refund</button>
      )}
    </div>
  )},
];

export function Transactions() {
  const { data, loading, error, refetch } = useApi(paymentsAPI.list, []);
  const payments = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const successful = payments.filter(p => p.status === 'completed').length;
  const failed     = payments.filter(p => p.status === 'failed').length;
  const pending    = payments.filter(p => p.status === 'pending').length;
  const totalRev   = payments.filter(p=>p.status==='completed').reduce((s,p)=>s+Number(p.amount||0),0);

  return (
    <div>
      <PageHeader title="Transactions" subtitle="All payment transactions" breadcrumb={['Payments', 'Transactions']}>
        <button className="btn btn-secondary btn-sm"><Download size={14} /> Export</button>
      </PageHeader>
      <div className="grid-stat mb-24">
        <StatCard label="Total Revenue"  value={`₹${(totalRev/1000).toFixed(1)}K`} icon={DollarSign}    color="green"  />
        <StatCard label="Successful"     value={successful}                          icon={CheckCircle}   color="teal"   />
        <StatCard label="Failed"         value={failed}                              icon={AlertTriangle} color="pink"   />
        <StatCard label="Pending"        value={pending}                             icon={Clock}         color="yellow" />
      </div>
      <DataTable
        title="All Transactions"
        columns={TX_COLS}
        data={payments}
        searchKeys={['transaction_id','customer_name','driver_name','ride_id']}
        filters={[
          { key: 'status',         label: 'Status', options: [{value:'completed',label:'Completed'},{value:'failed',label:'Failed'},{value:'pending',label:'Pending'}] },
          { key: 'payment_method', label: 'Method', options: [{value:'cash',label:'Cash'},{value:'upi',label:'UPI'},{value:'wallet',label:'Wallet'},{value:'card',label:'Card'}] },
          { key: 'gateway',        label: 'Gateway',options: [{value:'razorpay',label:'Razorpay'},{value:'paytm',label:'Paytm'},{value:'phonepe',label:'PhonePe'}] },
        ]}
      />
    </div>
  );
}

export function Refunds() {
  const { data, loading, error, refetch } = useApi(paymentsAPI.refunds, []);
  const refunds = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const RCOLS = [
    { key: 'transaction_id', label: 'Refund ID',  render: v => <strong style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--accent-pink)' }}>{v}</strong> },
    { key: 'customer_name',  label: 'Customer',   render: v => <strong>{v}</strong> },
    { key: 'ride_id',        label: 'Ride',       render: v => v ? <span style={{ color: 'var(--accent-primary)', fontSize: 12 }}>#{v}</span> : '—' },
    { key: 'amount',         label: 'Amount',     render: v => <strong>₹{v}</strong> },
    { key: 'payment_method', label: 'Method' },
    { key: 'status',         label: 'Status',     render: v => <StatusBadge status={v} /> },
    { key: 'created_at',     label: 'Date',       render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span> },
  ];
  return (
    <div>
      <PageHeader title="Refunds" subtitle="Processed and pending refunds" breadcrumb={['Payments', 'Refunds']} />
      <DataTable title="Refunds" columns={RCOLS} data={refunds} searchKeys={['customer_name','ride_id']} />
    </div>
  );
}

export function DriverPayouts() {
  const { data, loading, error, refetch } = useApi(paymentsAPI.payouts, []);
  const payouts = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const PCOLS = [
    { key: 'payout_id',   label: 'Payout ID', render: v => <strong style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--accent-secondary)' }}>{v}</strong> },
    { key: 'driver_name', label: 'Driver',    render: v => <strong>{v}</strong> },
    { key: 'amount',      label: 'Amount',    render: v => <strong style={{ color: 'var(--status-active)' }}>₹{v}</strong> },
    { key: 'method',      label: 'Method' },
    { key: 'status',      label: 'Status',    render: v => <StatusBadge status={v} /> },
    { key: 'created_at',  label: 'Date',      render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span> },
    { key: 'actions',     label: '',          render: (_, row) => (
      <div style={{ display: 'flex', gap: 5 }}>
        {row.status === 'pending' && (
          <button className="btn btn-sm btn-success" onClick={() => paymentsAPI.processPayout(row.id).then(refetch)}>
            <CheckCircle size={13} /> Process
          </button>
        )}
        <button className="btn btn-sm btn-ghost"><Eye size={13} /></button>
      </div>
    )},
  ];
  return (
    <div>
      <PageHeader title="Driver Payouts" subtitle="Process driver earnings payouts" breadcrumb={['Payments', 'Payouts']} />
      <DataTable title="Payouts" columns={PCOLS} data={payouts} searchKeys={['driver_name','payout_id']}
        filters={[{ key: 'status', label: 'Status', options: [{value:'pending',label:'Pending'},{value:'completed',label:'Completed'}] }]}
      />
    </div>
  );
}

export function Commission() {
  const { data, loading, error } = useApi(earningsAPI.commission, []);
  const commissions = Array.isArray(data) ? data : (data?.results ?? data?.commissions ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const CCOLS = [
    { key: 'vehicle_type',    label: 'Vehicle',       render: v => <span className="badge badge-primary">{v}</span> },
    { key: 'commission_type', label: 'Type' },
    { key: 'commission',      label: 'Rate',          render: v => <strong style={{ color: 'var(--accent-primary)', fontSize: 16 }}>{v}%</strong> },
    { key: 'this_month',      label: 'This Month',    render: v => <strong style={{ color: 'var(--status-active)' }}>₹{v ?? 0}</strong> },
    { key: 'total_collected', label: 'Total Collected', render: v => `₹${v ?? 0}` },
    { key: 'actions',         label: '',              render: () => <button className="btn btn-sm btn-ghost">Edit Rate</button> },
  ];
  return (
    <div>
      <PageHeader title="Commission" subtitle="Manage platform commission rates per vehicle type" breadcrumb={['Payments', 'Commission']} />
      <DataTable title="Commission Rates" columns={CCOLS} data={commissions} />
    </div>
  );
}
