import DashboardLayout from '../../components/DashboardLayout';

function UserDashboardPage() {
  return (
    <DashboardLayout
      role="USER"
      title="User Dashboard"
      description="사용자용 기본 대시보드입니다."
    >
      <div className="card-grid">
        <div className="card">운행 요약</div>
        <div className="card">차량 상태</div>
        <div className="card">알림 센터</div>
        <div className="card">최근 활동</div>
      </div>
    </DashboardLayout>
  );
}

export default UserDashboardPage;
