import { Modal } from "@/components/modal";
import { AuthCard } from "@/components/auth/auth-card";

export default function LoginModal() {
  return (
    <Modal>
      <AuthCard initialSide="login" />
    </Modal>
  );
}