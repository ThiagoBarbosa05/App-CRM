import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  CalendarIcon,
  MapPinIcon,
  UsersIcon,
  ClockIcon,
  ImageIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, baseS3Url } from "@/lib/utils";

interface EventAttachment {
  id?: string;
  eventId?: string;
  fileName: string;
  fileUrl: string;
  uploadedAt?: string;
}

interface Event {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  eventDate: string;
  registrationDeadline: string | null;
  location: string;
  pricePerPerson: string;
  maxCapacity: number | null;
  category: string;
  status: "planejado" | "ativo" | "finalizado" | "cancelado";
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  creatorName: string;
  participantCount: number;
  attachments?: EventAttachment[];
}

const EVENT_STATUS = [
  {
    value: "planejado",
    label: "Planejado",
    color: "bg-blue-100 text-blue-800",
  },
  { value: "ativo", label: "Ativo", color: "bg-green-100 text-green-800" },
  {
    value: "finalizado",
    label: "Finalizado",
    color: "bg-gray-100 text-gray-800",
  },
  { value: "cancelado", label: "Cancelado", color: "bg-red-100 text-red-800" },
];

export default function EventsDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = EVENT_STATUS.find((s) => s.value === status);
    return <Badge className={statusConfig?.color}>{statusConfig?.label}</Badge>;
  };

  const getDaysUntilEvent = (eventDate: string) => {
    const today = new Date();
    const event = new Date(eventDate);
    const diffTime = event.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handlePrintParticipants = async (event: Event) => {
    try {
      // Buscar participantes do evento
      const response = await fetch(`/api/events/${event.id}/participants`, {
        headers: {
          "x-user-id": user?.id || "",
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao buscar participantes");
      }

      const participants = await response.json();

      // Função para converter status
      const getStatusLabel = (status: string) => {
        const statusMap: { [key: string]: string } = {
          inscrito: "PAGO",
          confirmado: "CONVIDADO",
          presente: "PENDENTE",
          ausente: "PAGAR NA HORA",
          cancelado: "CANCELADO",
        };
        return statusMap[status] || status;
      };

      // Função para obter status do evento
      const getEventStatusLabel = (status: string) => {
        const statusConfig = EVENT_STATUS.find((s) => s.value === status);
        return statusConfig?.label || status;
      };

      // Gerar linhas da tabela
      const participantRows =
        participants.length > 0
          ? participants
              .map(
                (participant: any) => `
            <tr>
              <td>${participant.clientName || "N/A"}</td>
              <td>${participant.clientPhone || "N/A"}</td>
              <td style="text-align: center; font-weight: bold;">${
                participant.numberOfParticipants || 1
              }</td>
              <td><span class="status-badge status-${
                participant.status
              }">${getStatusLabel(participant.status)}</span></td>
              <td>${formatDate(participant.registrationDate)}</td>
              <td>${participant.notes || ""}</td>
            </tr>
          `
              )
              .join("")
          : '<tr><td colspan="6" style="text-align: center; font-style: italic;">Nenhum participante cadastrado</td></tr>';

      // Gerar HTML para impressão
      const printContent = `<!DOCTYPE html>
<html>
<head>
  <title>Lista de Participantes - ${event.name}</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      margin: 20px;
      color: #333;
    }
    .header { 
      text-align: center; 
      margin-bottom: 30px;
      border-bottom: 2px solid #ccc;
      padding-bottom: 20px;
    }
    .event-info { 
      margin-bottom: 30px; 
    }
    .event-info h2 { 
      color: #2563eb; 
      margin-bottom: 10px;
    }
    .event-details { 
      display: grid; 
      grid-template-columns: 1fr 1fr; 
      gap: 20px; 
      margin-bottom: 20px;
    }
    .info-item { 
      margin-bottom: 8px; 
    }
    .info-label { 
      font-weight: bold; 
      color: #666;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 20px;
    }
    th, td { 
      border: 1px solid #ddd; 
      padding: 12px; 
      text-align: left; 
    }
    th { 
      background-color: #f5f5f5; 
      font-weight: bold;
      color: #333;
    }
    .status-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }
    .status-inscrito { background-color: #dbeafe; color: #1e40af; }
    .status-confirmado { background-color: #dcfce7; color: #15803d; }
    .status-presente { background-color: #d1fae5; color: #047857; }
    .status-ausente { background-color: #fed7aa; color: #ea580c; }
    .status-cancelado { background-color: #fee2e2; color: #dc2626; }
    .event-images {
      margin: 25px 0;
      page-break-inside: avoid;
    }
    .event-images h3 {
      color: #4f46e5;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .images-gallery {
      position: relative;
    }
    .images-grid {
      display: grid;
      gap: 12px;
      margin-top: 15px;
    }
    .images-grid.single {
      grid-template-columns: 1fr;
      max-width: 400px;
      margin: 0 auto;
    }
    .images-grid.dual {
      grid-template-columns: repeat(2, 1fr);
      max-width: 600px;
      margin: 0 auto;
    }
    .images-grid.multi {
      grid-template-columns: 2fr 1fr;
      grid-template-rows: repeat(2, 1fr);
      max-width: 500px;
      margin: 0 auto;
    }
    .images-grid.grid-layout {
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      max-width: 800px;
      margin: 0 auto;
    }
    .image-container {
      position: relative;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }
    .image-container:hover {
      border-color: #4f46e5;
      box-shadow: 0 8px 25px rgba(79, 70, 229, 0.15);
      transform: translateY(-2px);
    }
    .image-container.main-image {
      grid-row: 1 / 3;
      aspect-ratio: 4/3;
      max-height: 250px;
      max-width: 300px;
    }
    .image-container.side-image {
      aspect-ratio: 16/9;
      max-height: 120px;
      max-width: 200px;
    }
    .image-container.single-image {
      aspect-ratio: 16/9;
      max-height: 300px;
      max-width: 400px;
      margin: 0 auto;
    }
    .image-container.grid-image {
      aspect-ratio: 4/3;
      max-height: 200px;
      max-width: 300px;
    }
    .image-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    .image-container img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .image-container:hover img {
      transform: scale(1.05);
    }
    .image-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        135deg, 
        rgba(79, 70, 229, 0.1) 0%, 
        rgba(139, 92, 246, 0.1) 100%
      );
      opacity: 0;
      transition: opacity 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .image-container:hover .image-overlay {
      opacity: 1;
    }
    .zoom-icon {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 50%;
      padding: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transform: scale(0.8);
      transition: transform 0.2s ease;
    }
    .image-container:hover .zoom-icon {
      transform: scale(1);
    }
    .image-fallback {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      color: #64748b;
    }
    .fallback-content {
      text-align: center;
      padding: 20px;
    }
    .image-icon {
      font-size: 2.5em;
      margin-bottom: 12px;
      opacity: 0.7;
    }
    .image-name {
      font-size: 13px;
      font-weight: 500;
      word-break: break-word;
      max-width: 180px;
      line-height: 1.4;
    }
    .image-counter {
      position: absolute;
      bottom: 12px;
      right: 12px;
      background: rgba(0, 0, 0, 0.75);
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      backdrop-filter: blur(8px);
    }
    .images-navigation {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 15px;
    }
    .nav-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #cbd5e1;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    .nav-dot.active {
      background: #4f46e5;
      transform: scale(1.2);
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 20px;
    }
    @media print {
      body { margin: 0; }
      .no-print { display: none; }

      .event-images {
        page-break-inside: avoid;
        margin: 20px 0;
      }

      .images-grid.single {
        grid-template-columns: 1fr;
        max-width: 300px;
        margin: 0 auto;
      }

      .images-grid.dual {
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        max-width: 400px;
        margin: 0 auto;
      }

      .images-grid.multi {
        grid-template-columns: 2fr 1fr;
        gap: 8px;
        max-width: 350px;
        margin: 0 auto;
      }

      .images-grid.grid-layout {
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
        max-width: 450px;
        margin: 0 auto;
      }

      .image-container {
        break-inside: avoid;
        border-width: 1px;
        box-shadow: none;
      }

      .image-container.single-image {
        max-height: 200px;
        max-width: 300px;
      }

      .image-container.main-image {
        max-height: 150px;
        max-width: 200px;
      }

      .image-container.side-image {
        max-height: 100px;
        max-width: 150px;
      }

      .image-container.grid-image {
        max-height: 100px;
        max-width: 150px;
      }

      .image-overlay,
      .zoom-icon {
        display: none !important;
      }

      .image-counter {
        background: rgba(0, 0, 0, 0.9);
        font-size: 11px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Lista de Participantes</h1>
  </div>

  <div class="event-info">
    <h2>${event.name}</h2>
    <div class="event-details">
      <div>
        <div class="info-item">
          <span class="info-label">Data:</span> ${formatDate(event.eventDate)}
        </div>
        <div class="info-item">
          <span class="info-label">Local:</span> ${event.location}
        </div>
        <div class="info-item">
          <span class="info-label">Categoria:</span> ${event.category}
        </div>
      </div>
      <div>
        <div class="info-item">
          <span class="info-label">Valor por Pessoa:</span> ${formatCurrency(
            parseFloat(event.pricePerPerson)
          )}
        </div>
        <div class="info-item">
          <span class="info-label">Capacidade:</span> ${
            event.maxCapacity
              ? `${event.participantCount}/${event.maxCapacity}`
              : event.participantCount
          }
        </div>
        <div class="info-item">
          <span class="info-label">Status:</span> ${getEventStatusLabel(
            event.status
          )}
        </div>
      </div>
    </div>
    ${
      event.description
        ? `<div class="info-item"><span class="info-label">Descrição:</span> ${event.description}</div>`
        : ""
    }
    ${
      event.attachments && event.attachments.length > 0
        ? `
        <div class="event-images">
          <h3>
            <span style="color: #4f46e5; font-size: 18px;">📸</span>
            Galeria do Evento (${event.attachments.length} ${
            event.attachments.length === 1 ? "imagem" : "imagens"
          })
          </h3>
          <div class="images-gallery">
            ${
              event.attachments.length === 1
                ? `
                <!-- Layout para uma imagem -->
                <div class="images-grid single">
                  <div class="image-container single-image">
                    <div class="image-wrapper">
                      <img 
                        src="${baseS3Url}${event.attachments[0].fileUrl}" 
                        alt="${event.attachments[0].fileName}"
                        onerror="this.style.display='none'; this.parentNode.nextElementSibling.style.display='flex';"
                      />
                      <div class="image-overlay">
                        <div class="zoom-icon">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                            <line x1="11" y1="8" x2="11" y2="14"></line>
                            <line x1="8" y1="11" x2="14" y2="11"></line>
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div class="image-fallback" style="display: none;">
                      <div class="fallback-content">
                        <div class="image-icon">📷</div>
                        <div class="image-name">${event.attachments[0].fileName}</div>
                      </div>
                    </div>
                  </div>
                </div>
                `
                : event.attachments.length === 2
                ? `
                <!-- Layout para duas imagens -->
                <div class="images-grid dual">
                  ${event.attachments
                    .map(
                      (attachment, index) => `
                    <div class="image-container side-image">
                      <div class="image-wrapper">
                        <img 
                          src="${baseS3Url}${attachment.fileUrl}" 
                          alt="${attachment.fileName}"
                          onerror="this.style.display='none'; this.parentNode.nextElementSibling.style.display='flex';"
                        />
                        <div class="image-overlay">
                          <div class="zoom-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2">
                              <circle cx="11" cy="11" r="8"></circle>
                              <path d="m21 21-4.35-4.35"></path>
                              <line x1="11" y1="8" x2="11" y2="14"></line>
                              <line x1="8" y1="11" x2="14" y2="11"></line>
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div class="image-fallback" style="display: none;">
                        <div class="fallback-content">
                          <div class="image-icon">📷</div>
                          <div class="image-name">${attachment.fileName}</div>
                        </div>
                      </div>
                    </div>
                  `
                    )
                    .join("")}
                </div>
                `
                : event.attachments.length === 3
                ? `
                <!-- Layout especial para três imagens -->
                <div class="images-grid multi">
                  <div class="image-container main-image">
                    <div class="image-wrapper">
                      <img 
                        src="${baseS3Url}${event.attachments[0].fileUrl}" 
                        alt="${event.attachments[0].fileName}"
                        onerror="this.style.display='none'; this.parentNode.nextElementSibling.style.display='flex';"
                      />
                      <div class="image-overlay">
                        <div class="zoom-icon">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                            <line x1="11" y1="8" x2="11" y2="14"></line>
                            <line x1="8" y1="11" x2="14" y2="11"></line>
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div class="image-fallback" style="display: none;">
                      <div class="fallback-content">
                        <div class="image-icon">📷</div>
                        <div class="image-name">${
                          event.attachments[0].fileName
                        }</div>
                      </div>
                    </div>
                  </div>
                  ${event.attachments
                    .slice(1, 3)
                    .map(
                      (attachment, index) => `
                    <div class="image-container side-image">
                      <div class="image-wrapper">
                        <img 
                          src="${baseS3Url}${attachment.fileUrl}" 
                          alt="${attachment.fileName}"
                          onerror="this.style.display='none'; this.parentNode.nextElementSibling.style.display='flex';"
                        />
                        <div class="image-overlay">
                          <div class="zoom-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2">
                              <circle cx="11" cy="11" r="8"></circle>
                              <path d="m21 21-4.35-4.35"></path>
                              <line x1="11" y1="8" x2="11" y2="14"></line>
                              <line x1="8" y1="11" x2="14" y2="11"></line>
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div class="image-fallback" style="display: none;">
                        <div class="fallback-content">
                          <div class="image-icon">📷</div>
                          <div class="image-name">${attachment.fileName}</div>
                        </div>
                      </div>
                    </div>
                  `
                    )
                    .join("")}
                </div>
                `
                : `
                <!-- Layout em grid para 4+ imagens -->
                <div class="images-grid grid-layout">
                  ${event.attachments
                    .slice(0, 6)
                    .map(
                      (attachment, index) => `
                    <div class="image-container grid-image">
                      <div class="image-wrapper">
                        <img 
                          src="${baseS3Url}${attachment.fileUrl}" 
                          alt="${attachment.fileName}"
                          onerror="this.style.display='none'; this.parentNode.nextElementSibling.style.display='flex';"
                        />
                        <div class="image-overlay">
                          <div class="zoom-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2">
                              <circle cx="11" cy="11" r="8"></circle>
                              <path d="m21 21-4.35-4.35"></path>
                              <line x1="11" y1="8" x2="11" y2="14"></line>
                              <line x1="8" y1="11" x2="14" y2="11"></line>
                            </svg>
                          </div>
                        </div>
                        ${
                          index === 5 &&
                          event.attachments &&
                          event.attachments.length > 6
                            ? `
                          <div class="image-counter">
                            +${event.attachments.length - 6} mais
                          </div>
                        `
                            : ""
                        }
                      </div>
                      <div class="image-fallback" style="display: none;">
                        <div class="fallback-content">
                          <div class="image-icon">�</div>
                          <div class="image-name">${attachment.fileName}</div>
                        </div>
                      </div>
                    </div>
                  `
                    )
                    .join("")}
                </div>
                ${
                  event.attachments.length > 6
                    ? `
                  <div style="text-align: center; margin-top: 15px; color: #64748b; font-size: 14px;">
                    <em>Mostrando 6 de ${event.attachments.length} imagens</em>
                  </div>
                `
                    : ""
                }
                `
            }
          </div>
        </div>
        `
        : ""
    }
  </div>

  <table>
    <thead>
      <tr>
        <th>Nome do Cliente</th>
        <th>Telefone</th>
        <th>Nº Participantes</th>
        <th>Status</th>
        <th>Data de Inscrição</th>
        <th>Observações</th>
      </tr>
    </thead>
    <tbody>
      ${participantRows}
    </tbody>
  </table>

  <div class="footer">
    <p>Lista gerada em ${new Date().toLocaleDateString(
      "pt-BR"
    )} às ${new Date().toLocaleTimeString("pt-BR")}</p>
    <p>Total de participantes: ${participants.reduce(
      (total: number, p: any) => total + (p.numberOfParticipants || 1),
      0
    )}</p>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`;

      // Abrir nova janela e imprimir
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
      } else {
        toast({
          title: "Erro",
          description:
            "Não foi possível abrir a janela de impressão. Verifique se pop-ups estão bloqueados.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao imprimir lista:", error);
      toast({
        title: "Erro",
        description: "Erro ao gerar lista de participantes para impressão",
        variant: "destructive",
      });
    }
  };

  // Filtrar eventos próximos (próximos 30 dias) e ativos
  const upcomingEvents = events
    .filter((event) => {
      const daysUntil = getDaysUntilEvent(event.eventDate);
      return (
        (event.status === "planejado" || event.status === "ativo") &&
        daysUntil >= 0 &&
        daysUntil <= 30
      );
    })
    .sort(
      (a, b) =>
        new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    )
    .slice(0, 10);

  if (isLoading) {
    return <div>Carregando eventos...</div>;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <Card className="shadow-none border-0 bg-transparent">
        <CardHeader className="pb-6 px-6 pt-6">
          <CardTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900">
            <div className="p-2 bg-purple-50 rounded-lg">
              <CalendarIcon className="h-5 w-5 text-purple-600 shrink-0" />
            </div>
            <span className="truncate">Próximos Eventos</span>
          </CardTitle>
          <CardDescription className="text-sm text-gray-600 mt-2">
            Eventos planejados e ativos dos próximos 30 dias para acompanhamento
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {upcomingEvents.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="bg-purple-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <CalendarIcon className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum evento próximo
              </h3>
              <p className="text-gray-500">
                Não há eventos programados para os próximos 30 dias
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {upcomingEvents.map((event) => {
                const daysUntil = getDaysUntilEvent(event.eventDate);
                const isToday = daysUntil === 0;
                const isTomorrow = daysUntil === 1;

                return (
                  <div
                    key={event.id}
                    className="group relative bg-white border border-gray-200 rounded-md overflow-hidden hover:border-gray-300 hover:shadow-md transition-all duration-200 ease-in-out"
                  >
                    {/* Indicador de urgência lateral */}
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1 z-10 ${
                        isToday
                          ? "bg-red-500"
                          : isTomorrow
                          ? "bg-orange-400"
                          : daysUntil <= 7
                          ? "bg-yellow-400"
                          : "bg-purple-400"
                      }`}
                    />

                    {/* Imagem de Capa com efeito esmaecido */}
                    {event.imageUrl && (
                      <div className="relative w-full h-40 overflow-hidden">
                        <img
                          src={event.imageUrl}
                          alt={event.name}
                          className="w-full h-full object-cover"
                        />
                        {/* Gradiente esmaecido suave para transição */}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent from-40% via-white/30 via-70% to-white" />
                      </div>
                    )}

                    {/* Header do Card */}
                    <div className={`p-6 pl-8 ${event.imageUrl ? '-mt-6 relative z-10' : ''}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg text-gray-900 mb-3 overflow-hidden text-ellipsis">
                            {event.name}
                          </h3>
                          <div className="flex flex-wrap gap-2 mb-4">
                            <Badge
                              className={`${
                                EVENT_STATUS.find(
                                  (s) => s.value === event.status
                                )?.color
                              } border-0 font-medium px-3 py-1 text-xs`}
                            >
                              {
                                EVENT_STATUS.find(
                                  (s) => s.value === event.status
                                )?.label
                              }
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-xs font-medium px-2 py-1 bg-gray-50 text-gray-700 border-gray-200"
                            >
                              {event.category}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Informações principais com ícones semânticos */}
                      <div className="space-y-3 mb-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              isToday
                                ? "bg-red-50"
                                : isTomorrow
                                ? "bg-orange-50"
                                : "bg-blue-50"
                            }`}
                          >
                            <CalendarIcon
                              className={`h-4 w-4 ${
                                isToday
                                  ? "text-red-600"
                                  : isTomorrow
                                  ? "text-orange-600"
                                  : "text-blue-600"
                              }`}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {formatDate(event.eventDate)}
                            </div>
                            <div className="text-sm">
                              {isToday && (
                                <span className="text-red-600 font-bold">
                                  🔴 Hoje!
                                </span>
                              )}
                              {isTomorrow && (
                                <span className="text-orange-600 font-bold">
                                  🟠 Amanhã
                                </span>
                              )}
                              {!isToday && !isTomorrow && daysUntil > 0 && (
                                <span className="text-blue-600">
                                  📅 Em {daysUntil} dias
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-50 rounded-lg">
                            <MapPinIcon className="h-4 w-4 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {event.location}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-50 rounded-lg">
                            <UsersIcon className="h-4 w-4 text-purple-600" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {event.participantCount} participante(s)
                              {event.maxCapacity && ` / ${event.maxCapacity}`}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-50 rounded-lg">
                            <ClockIcon className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-bold text-emerald-700">
                              {formatCurrency(parseFloat(event.pricePerPerson))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Imagens do evento */}
                      {event.attachments && event.attachments.length > 0 && (
                        <div className="mb-5">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 bg-purple-50 rounded-lg">
                              <ImageIcon className="h-4 w-4 text-purple-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-700">
                              {event.attachments.length} imagem
                              {event.attachments.length !== 1 ? "s" : ""} do
                              evento
                            </span>
                          </div>

                          {/* Carousel de imagens */}
                          <div className="relative">
                            <Carousel
                              opts={{
                                align: "start",
                                loop: true,
                              }}
                              className="w-full"
                            >
                              <CarouselContent className="-ml-2 md:-ml-4">
                                {event.attachments.map((attachment, index) => (
                                  <CarouselItem
                                    key={index}
                                    className="pl-2 md:pl-4 basis-full"
                                  >
                                    <div className="relative group aspect-video bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg overflow-hidden border border-purple-200 hover:border-purple-300 transition-all shadow-sm hover:shadow-md">
                                      <img
                                        src={`${baseS3Url}${attachment.fileUrl}`}
                                        alt={attachment.fileName}
                                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                                        onError={(e) => {
                                          const target =
                                            e.target as HTMLImageElement;
                                          target.style.display = "none";
                                          target.nextElementSibling?.classList.remove(
                                            "hidden"
                                          );
                                        }}
                                      />
                                      <div className="hidden absolute inset-0 bg-gradient-to-br from-purple-50 to-purple-100">
                                        <div className="flex items-center justify-center h-full">
                                          <div className="text-center text-purple-600">
                                            <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                                            <span className="text-sm font-medium break-words px-2">
                                              {attachment.fileName}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Overlay sutil com informações */}
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="absolute bottom-0 left-0 right-0 p-3">
                                          <div className="text-white text-xs font-medium truncate">
                                            {attachment.fileName}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Indicador de posição */}
                                      {event.attachments && event.attachments.length > 1 && (
                                        <div className="absolute top-3 right-3">
                                          <div className="bg-black/70 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                                            {index + 1}/
                                            {event.attachments.length}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </CarouselItem>
                                ))}
                              </CarouselContent>

                              {/* Botões de navegação - só aparecem se houver mais de 1 imagem */}
                              {event.attachments.length > 1 && (
                                <>
                                  <CarouselPrevious className="absolute -left-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-white/90 hover:bg-white border-purple-200 hover:border-purple-300 text-purple-600 hover:text-purple-700 shadow-lg" />
                                  <CarouselNext className="absolute -right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-white/90 hover:bg-white border-purple-200 hover:border-purple-300 text-purple-600 hover:text-purple-700 shadow-lg" />
                                </>
                              )}
                            </Carousel>

                            {/* Indicadores de pontos para navegação */}
                            {event.attachments.length > 1 &&
                              event.attachments.length <= 5 && (
                                <div className="flex justify-center mt-3 gap-2">
                                  {event.attachments.map((_, index) => (
                                    <div
                                      key={index}
                                      className="w-2 h-2 rounded-full bg-purple-200 hover:bg-purple-400 transition-colors cursor-pointer"
                                      title={`Imagem ${index + 1}`}
                                    />
                                  ))}
                                </div>
                              )}
                          </div>
                        </div>
                      )}

                      {/* Descrição */}
                      {event.description && (
                        <div className="mb-4">
                          <div
                            className="text-sm text-gray-600 leading-relaxed overflow-hidden text-ellipsis rich-text-content"
                            dangerouslySetInnerHTML={{
                              __html: event.description,
                            }}
                          />
                        </div>
                      )}

                      {/* Deadline de inscrição */}
                      {event.registrationDeadline && (
                        <div className="mb-4">
                          <div className="text-xs bg-orange-50 text-orange-800 p-3 rounded-lg border-l-4 border-orange-400">
                            <div className="font-semibold">
                              ⏰ Prazo de inscrição
                            </div>
                            <div className="mt-1">
                              {formatDate(event.registrationDeadline)}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Botão de ação */}
                      <div className="pt-4 border-t border-gray-100">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePrintParticipants(event)}
                          data-testid="button-print-participants"
                          className="w-full hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-colors font-medium"
                        >
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          Ver Detalhes do Evento
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
