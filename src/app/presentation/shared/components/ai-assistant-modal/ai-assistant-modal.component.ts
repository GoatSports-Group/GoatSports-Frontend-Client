import { AfterViewChecked, Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AiRepositoryPort } from '@application/ports/ai.repository.port';
import { ChatbotCardModel, ChatbotSourceModel } from '@domain/models/matchmaking.model';

interface ChatMessage {
  sender: 'AI' | 'USER';
  text: string;
  actions?: string[];
  /** Dữ liệu thật trợ lý đã tra (sân, giờ trống, giải, đơn). */
  cards?: ChatbotCardModel[];
  /** Chỉ các nguồn câu trả lời thật sự trích, giữ đúng số N của [Nguồn N]. */
  sources?: { n: number; label: string }[];
  /** Câu người dùng hỏi dẫn tới câu trả lời này; có thì mới báo "Chưa hữu ích" được. */
  question?: string;
  feedback?: 'sending' | 'sent';
}


/** API trả mọi đoạn đã lấy ra; chỉ hiện những đoạn có "[Nguồn N]" trong câu trả lời, giữ đúng số N. */
export function citedSources(answer: string, sources: readonly ChatbotSourceModel[]): { n: number; label: string }[] {
  return sources
    .map((source, index) => ({ n: index + 1, label: source.heading ? `${source.title} › ${source.heading}` : source.title }))
    .filter(source => answer.includes(`[Nguồn ${source.n}]`));
}

/** Icon theo loại thẻ dữ liệu. */
export const CARD_ICON: Record<ChatbotCardModel['kind'], string> = {
  VENUE: 'store', SLOTS: 'clock', TOURNAMENT: 'trophy', BOOKING: 'ticket', CLUB: 'users'
};

@Component({
  selector: 'app-ai-assistant-modal',
  templateUrl: './ai-assistant-modal.component.html',
  styleUrls: ['./ai-assistant-modal.component.scss'],
  standalone: false
})
export class AiAssistantModalComponent implements AfterViewChecked {

  isOpen = false;
  inputText = '';
  loading = false;
  readonly cardIcon = CARD_ICON;
  /** Cùng mã trong một phiên trang: trợ lý nhớ vài lượt trước để hiểu câu hỏi nối tiếp. */
  private conversationId = crypto.randomUUID();
  private scrollPending = false;

  @ViewChild('messageList') private messageList?: ElementRef<HTMLDivElement>;

  messages: ChatMessage[] = [
    {
      sender: 'AI',
      text: 'Xin chào! Mình là GOAT AI. Mình tìm được sân, giá và giờ còn trống, giải đang mở đăng ký, CLB của bạn, tình trạng đơn đặt sân, và giải đáp chính sách đặt sân, hủy sân.',
      actions: ['Giải đang mở đăng ký', 'Đơn đặt sân của tôi', 'Chính sách hủy sân']
    }
  ];

  constructor(
    private readonly aiRepo: AiRepositoryPort,
    private readonly router: Router
  ) {}

  ngAfterViewChecked(): void {
    if (!this.scrollPending || !this.messageList) return;
    this.scrollPending = false;
    const element = this.messageList.nativeElement;
    element.scrollTop = element.scrollHeight;
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) this.scrollPending = true;
  }

  minimizeChat(): void {
    this.isOpen = false;
  }

  closeChat(): void {
    this.isOpen = false;
    this.inputText = '';
  }

  @HostListener('document:keydown.escape')
  closeFromKeyboard(): void {
    if (this.isOpen) this.minimizeChat();
  }

  sendMessage(text?: string): void {
    const query = text || this.inputText;
    if (!query.trim() || this.loading) return;

    this.messages.push({ sender: 'USER', text: query });
    this.inputText = '';
    this.loading = true;
    this.scrollPending = true;

    this.aiRepo.queryChatbot(query, this.conversationId).subscribe({
      next: (res) => {
        this.loading = false;
        this.messages.push({
          sender: 'AI',
          text: res.answer,
          actions: res.suggestedActions,
          cards: res.cards ?? [],
          sources: citedSources(res.answer, res.sources ?? []),
          question: query
        });
        this.scrollPending = true;
      },
      error: () => {
        this.loading = false;
        this.messages.push({
          sender: 'AI',
          text: 'Xin lỗi, hệ thống AI đang bảo trì. Vui lòng thử lại sau.'
        });
        this.scrollPending = true;
      }
    });
  }

  reportUnhelpful(message: ChatMessage): void {
    if (!message.question || message.feedback) return;
    message.feedback = 'sending';
    this.aiRepo.reportUnhelpfulAnswer(message.question, message.text, this.conversationId).subscribe({
      next: () => message.feedback = 'sent',
      error: () => message.feedback = undefined
    });
  }

  openCard(card: ChatbotCardModel): void {
    if (!card.link) return;
    this.isOpen = false;
    this.router.navigateByUrl(card.link);
  }

}
