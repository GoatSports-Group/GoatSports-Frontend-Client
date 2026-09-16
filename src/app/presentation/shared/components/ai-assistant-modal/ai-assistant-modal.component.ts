import { AfterViewChecked, Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AiRepositoryPort } from '@application/ports/ai.repository.port';
import { VenueRecommendation } from '@application/dto/matchmaking/matchmaking.dto';

interface ChatMessage {
  sender: 'AI' | 'USER';
  text: string;
  actions?: string[];
  venues?: VenueRecommendation[];
}


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
  private scrollPending = false;

  @ViewChild('messageList') private messageList?: ElementRef<HTMLDivElement>;

  messages: ChatMessage[] = [
    {
      sender: 'AI',
      text: 'Xin chào! Tôi là trợ lý AI GOAT Sports. Tôi có thể hỗ trợ bạn tìm sân bãi, gợi ý đối thủ ghép kèo hoặc hướng dẫn quy trình check-in.',
      actions: ['Sân cầu lông gần tôi', 'Tìm đối thủ AI', 'Quy định hủy sân']
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

    this.aiRepo.queryChatbot(query).subscribe({
      next: (res) => {
        this.loading = false;
        this.messages.push({
          sender: 'AI',
          text: res.answer,
          actions: res.suggestedActions,
          venues: res.recommendedVenues
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

  goToVenue(id: string): void {
    this.isOpen = false;
    this.router.navigate(['/venues', id]);
  }

}
