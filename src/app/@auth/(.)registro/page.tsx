import { Modal } from "@/components/modal";
import { AuthCard } from "@/components/auth/auth-card";

export default function RegistroModal() {
  return (
    <Modal>
      <AuthCard initialSide="registro" />
    </Modal>
  );
}