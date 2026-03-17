import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetSurveys, 
  useGetSurvey,
  useCreateSurvey, 
  useUpdateSurvey, 
  useDeleteSurvey,
  getGetSurveysQueryKey,
  getGetSurveyQueryKey
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export function useSurveysList() {
  return useGetSurveys();
}

export function useSurveyDetail(id: number) {
  return useGetSurvey(id, { query: { enabled: !!id } });
}

export function useSurveyMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const create = useCreateSurvey({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSurveysQueryKey() });
        toast({ title: "Başarılı", description: "Anket başarıyla oluşturuldu." });
      },
      onError: () => toast({ title: "Hata", description: "Anket oluşturulamadı.", variant: "destructive" })
    }
  });

  const update = useUpdateSurvey({
    mutation: {
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries({ queryKey: getGetSurveysQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSurveyQueryKey(variables.id) });
        toast({ title: "Başarılı", description: "Anket güncellendi." });
      },
      onError: () => toast({ title: "Hata", description: "Anket güncellenemedi.", variant: "destructive" })
    }
  });

  const remove = useDeleteSurvey({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSurveysQueryKey() });
        toast({ title: "Başarılı", description: "Anket silindi." });
      },
      onError: () => toast({ title: "Hata", description: "Anket silinemedi.", variant: "destructive" })
    }
  });

  return { create, update, remove };
}
