import React, { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, PageHeader, StatusBadge, Button, Input, Select, Label, Modal, LoadingScreen } from "@/components/ui-elements";
import { useTriggersList, useTriggerMutations } from "@/hooks/use-triggers";
import { Plus, Zap, Power, PowerOff, Trash2 } from "lucide-react";

export default function Triggers() {
  const { data: triggers, isLoading } = useTriggersList();
  const { create, update, remove } = useTriggerMutations();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const initialForm = { name: "", event: "rage_click", channel: "in-app", delayMinutes: 0 };
  const [formData, setFormData] = useState(initialForm);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({ data: formData as any }, {
      onSuccess: () => {
        setIsCreateOpen(false);
        setFormData(initialForm);
      }
    });
  };

  const getEventName = (event: string) => {
    const events: Record<string, string> = {
      purchase: "Satın Alma",
      ticket_close: "Talep Kapatma",
      onboarding_abandon: "Kayıt Terki",
      payment_confusion: "Ödeme Karışıklığı",
      rage_click: "Öfke Tıklaması (Rage Click)",
      cancellation_intent: "İptal Niyeti",
      survey_complete: "Anket Tamamlandı"
    };
    return events[event] || event;
  };

  if (isLoading) return <Layout><LoadingScreen /></Layout>;

  return (
    <Layout>
      <PageHeader 
        title="Davranışsal Tetikleyiciler" 
        description="Müşteri davranışlarına göre anlık iletişim kurallarını yönetin."
      >
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Yeni Kural
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {triggers?.map((trigger) => (
          <Card key={trigger.id} className={`p-6 transition-all border-l-4 ${trigger.isActive ? 'border-l-primary' : 'border-l-muted opacity-60'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-secondary rounded-xl text-primary">
                <Zap className="h-6 w-6" />
              </div>
              <StatusBadge status={trigger.isActive ? "Aktif" : "Pasif"} variant={trigger.isActive ? "success" : "outline"} />
            </div>
            
            <h3 className="text-xl font-bold text-foreground mb-1">{trigger.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">Olay: <span className="font-semibold text-foreground">{getEventName(trigger.event)}</span></p>
            
            <div className="grid grid-cols-2 gap-2 mb-6">
              <div className="bg-black/20 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Gecikme</p>
                <p className="font-mono text-sm">{trigger.delayMinutes === 0 ? "Anında" : `${trigger.delayMinutes} dk`}</p>
              </div>
              <div className="bg-black/20 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Kanal</p>
                <p className="font-mono text-sm capitalize">{trigger.channel}</p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border/50 pt-4">
              <div className="text-xs text-muted-foreground">
                <span className="font-bold text-foreground">{trigger.firedCount}</span> kez tetiklendi
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  className={`p-2 ${trigger.isActive ? 'text-warning hover:bg-warning/10 hover:text-warning' : 'text-success hover:bg-success/10 hover:text-success'}`}
                  onClick={() => update.mutate({ id: trigger.id, data: { isActive: !trigger.isActive } })}
                  title={trigger.isActive ? "Durdur" : "Başlat"}
                >
                  {trigger.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" className="p-2 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => remove.mutate({ id: trigger.id })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Yeni Tetikleyici Oluştur">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label>Kural Adı</Label>
            <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Örn: Sepette Terk Edenler" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tetikleyici Olay</Label>
              <Select value={formData.event} onChange={e => setFormData({...formData, event: e.target.value})}>
                <option value="rage_click">Öfke Tıklaması (Rage Click)</option>
                <option value="cancellation_intent">İptal Niyeti</option>
                <option value="payment_confusion">Ödeme Karışıklığı</option>
                <option value="onboarding_abandon">Kayıt Terki</option>
                <option value="purchase">Satın Alma</option>
                <option value="ticket_close">Talep Kapatma</option>
              </Select>
            </div>
            <div>
              <Label>Kanal</Label>
              <Select value={formData.channel} onChange={e => setFormData({...formData, channel: e.target.value})}>
                <option value="in-app">In-App (Uygulama İçi)</option>
                <option value="web">Web Popup</option>
                <option value="email">E-posta</option>
                <option value="sms">SMS</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Gecikme Süresi (Dakika)</Label>
            <Input type="number" min="0" required value={formData.delayMinutes} onChange={e => setFormData({...formData, delayMinutes: parseInt(e.target.value) || 0})} />
            <p className="text-xs text-muted-foreground mt-1">Anında tetiklenmesi için 0 girin.</p>
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>İptal</Button>
            <Button type="submit" isLoading={create.isPending}>Kaydet</Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
