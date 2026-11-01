import { NavLink } from "react-router"; // Import Link for routing
import "../../placement_officer/components/sidebar.css";
import { Building2, NotebookPen, Send, Verified, FileBarChart2 } from "lucide-react";
import { logout, redirectToProfile } from "@/utils";
import { SERVER_URL } from "@/constant";
import Logo from "@/assets/img/logo.png";
import ProfileIcon from "@/assets/img/user_profile_new.png";
import LogoutIcon from "@/assets/img/logout_new.png";
const Sidebar = () => {
  const handleLogout = async () => {
    await logout();
    window.location.href = `${SERVER_URL}/auth/login/`;
  };
  return (
    <aside className="sidebar">
      <div className="logo-container">
        <img src={Logo} alt="TCET Logo" className="logo" />
        <h1 className="title">TCET - TNP</h1>
      </div>
      <ul className="menu">
        <NavLink to="" end className="menu-item gap-3">
          <NotebookPen />
          <p>Notice Creation</p>
        </NavLink>
        <NavLink to="placement_companies" className="menu-item gap-3">
          <Building2 />
          <p>Placement Companies</p>
        </NavLink>
        <NavLink to="internship/register" className="menu-item gap-3">
          <Building2 />
          <p>InternShip Company Form</p>
        </NavLink>
        <NavLink to="internship/verify" className="menu-item gap-3">
          <Verified />
          <p>Verify Internship</p>
        </NavLink>
        <NavLink to="student-management" className="menu-item gap-3">
          <Verified />
          <p>Student Management</p>
        </NavLink>
        <NavLink to="batch-categorize" className="menu-item gap-3">
          <Verified />
          <p>Student Category</p>
        </NavLink>
        <NavLink to="/notifications/create" className="menu-item gap-3">
          <Send />
          <p>Notification</p>
        </NavLink>
        <NavLink to="reports" className="menu-item gap-3">
          <FileBarChart2 />
          <p>Report</p>
        </NavLink>
      </ul>
      <div className="bottom-menu">
        <button
          className="sidebar-action-button profile-icon bg-transparent hover:bg-transparent"
          onClick={redirectToProfile}
          aria-label="Profile"
        >
          <img src={ProfileIcon} alt="Profile" className="sidebar-action-icon" />
        </button>
        <button
          className="sidebar-action-button logout-icon bg-transparent hover:bg-transparent"
          onClick={handleLogout}
          aria-label="Logout"
        >
          <img src={LogoutIcon} alt="Logout" className="sidebar-action-icon" />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
