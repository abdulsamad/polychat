import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface DeleteAlertProps {
  children?: React.ReactNode;
  onDelete: () => void;
  onCancel?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const DeleteAlert = ({ children, onDelete, onCancel, open, onOpenChange }: DeleteAlertProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    {children && <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>}
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
        <AlertDialogDescription>
          This action cannot be undone. This will permanently delete your thread.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel asChild>
          <Button
            variant="secondary"
            onClick={(ev) => {
              ev.stopPropagation();
              onCancel?.();
            }}>
            Cancel
          </Button>
        </AlertDialogCancel>
        <AlertDialogAction asChild>
          <Button
            variant="destructive"
            className="transition-transform duration-300 ease-in-out hover:scale-95 active:scale-90"
            onClick={(ev) => {
              ev.stopPropagation();
              onDelete();
            }}>
            Delete
          </Button>
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default DeleteAlert;
