import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
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
export class AiAssistantModalComponent implements OnInit, OnDestroy {

  isOpen = false;
  isDocked = false;
  inputText = '';
  loading = false;

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

  private navigationSubscription?: Subscription;

  ngOnInit(): void {
    this.syncWithRoute(this.router.url);
    this.navigationSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => this.syncWithRoute(event.urlAfterRedirects));
  }

  ngOnDestroy(): void {
    this.navigationSubscription?.unsubscribe();
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;
  }

  sendMessage(text?: string): void {
    const query = text || this.inputText;
    if (!query.trim() || this.loading) return;

    this.messages.push({ sender: 'USER', text: query });
    this.inputText = '';
    this.loading = true;

    this.aiRepo.queryChatbot(query).subscribe({
      next: (res) => {
        this.loading = false;
        this.messages.push({
          sender: 'AI',
          text: res.answer,
          actions: res.suggestedActions,
          venues: res.recommendedVenues
        });
      },
      error: () => {
        this.loading = false;
        this.messages.push({
          sender: 'AI',
          text: 'Xin lỗi, hệ thống AI đang bảo trì. Vui lòng thử lại sau.'
        });
      }
    });
  }

  goToVenue(id: string): void {
    this.isOpen = false;
    this.router.navigate(['/venues', id]);
  }

  private syncWithRoute(url: string): void {
    this.isDocked = url.startsWith('/matchmaking');
    if (this.isDocked) this.isOpen = true;
  }
}
