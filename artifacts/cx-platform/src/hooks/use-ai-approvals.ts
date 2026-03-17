import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetAiApprovals, 
  useApproveAiContent, 
  useRejectAiContent,
  getGetAiApprovalsQueryKey
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export function useAiApprovalsList() {
  return useGetAiApprovals();
}

export function useAiApprovalMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const approve = useApproveAiContent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAiApprovalsQueryKey() });
        toast({ title: "Onaylandı", description: "AI içeriği başarıyla onaylandı ve gönderime hazır." });
      },
      onError: () => toast({ title: "Hata", description: "İşlem başarısız oldu.", variant: "destructive" })
    }
  });

  const reject = useRejectAiContent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAiApprovalsQueryKey() });
        toast({ title: "Reddedildi", description: "İçerik reddedildi ve geri bildirildi." });
      },
      onError: () => toast({ title: "Hata", description: "İşlem başarısız oldu.", variant: "destructive" })
    }
  });

  return { approve, reject };
}
