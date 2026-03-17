import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetTriggers, 
  useCreateTrigger, 
  useUpdateTrigger, 
  useDeleteTrigger,
  getGetTriggersQueryKey
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export function useTriggersList() {
  return useGetTriggers();
}

export function useTriggerMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const create = useCreateTrigger({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTriggersQueryKey() });
        toast({ title: "Başarılı", description: "Tetikleyici oluşturuldu." });
      },
      onError: () => toast({ title: "Hata", description: "Tetikleyici oluşturulamadı.", variant: "destructive" })
    }
  });

  const update = useUpdateTrigger({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTriggersQueryKey() });
        toast({ title: "Başarılı", description: "Tetikleyici güncellendi." });
      },
      onError: () => toast({ title: "Hata", description: "Tetikleyici güncellenemedi.", variant: "destructive" })
    }
  });

  const remove = useDeleteTrigger({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTriggersQueryKey() });
        toast({ title: "Başarılı", description: "Tetikleyici silindi." });
      },
      onError: () => toast({ title: "Hata", description: "Tetikleyici silinemedi.", variant: "destructive" })
    }
  });

  return { create, update, remove };
}
