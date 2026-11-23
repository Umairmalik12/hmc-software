import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import {
  AdminAssistantService,
  AssistantMatch,
  AssistantMessage,
} from '../../Services/admin-assistant.service';

@Component({
  selector: 'app-admin-assistant',
  templateUrl: './admin-assistant.component.html',
  styleUrls: ['./admin-assistant.component.css', './admin-assistant-chat.css', './admin-assistant-lookup.css'],
})
export class AdminAssistantComponent
  implements OnInit, OnDestroy, AfterViewChecked
{
  @ViewChild('conversation') conversation?: ElementRef<HTMLElement>;
  tab: 'chat' | 'medicines' | 'patients' = 'chat';
  models: string[] = [];
  model = '';
  connecting = false;
  connected = false;
  setup = false;
  connectionError = '';
  messages: AssistantMessage[] = [];
  draft = '';
  sending = false;
  chatError = '';
  searching = false;
  searchError = '';
  query = '';
  searched = false;
  results: AssistantMatch[] = [];
  limit = 20;
  readonly origin = window.location.origin;
  readonly setupCommand =
    '[Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "' +
    this.origin +
    '", "User")\n[Environment]::SetEnvironmentVariable("OLLAMA_NO_CLOUD", "1", "User")';
  readonly prompts = [
    'Explain a medicine’s uses and precautions',
    'Review general management of a disease',
    'Help me organize an anonymized clinical question',
  ];
  private request?: AbortController;
  private connection?: AbortController;
  private destroyed = false;
  private searchVersion = 0;
  private scroll = false;
  constructor(private assistant: AdminAssistantService) {}
  ngOnInit(): void {
    void this.connect();
  }
  ngAfterViewChecked(): void {
    if (this.scroll && this.conversation) {
      const element = this.conversation.nativeElement;
      element.scrollTop = element.scrollHeight;
      this.scroll = false;
    }
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    this.searchVersion++;
    this.request?.abort();
    this.connection?.abort();
    this.messages = [];
    this.results = [];
    this.draft = '';
    this.query = '';
  }
  async connect(): Promise<void> {
    if (this.sending) return;
    this.connection?.abort();
    const request = (this.connection = new AbortController());
    this.connecting = true;
    this.connected = false;
    this.connectionError = '';
    try {
      const models = await this.assistant.models(request.signal);
      if (this.destroyed || request !== this.connection) return;
      this.models = models;
      this.model = models.includes(this.model)
        ? this.model
        : models.find((model) => model === 'gemma3:1b') || models.find((model) => model === 'gemma3:4b') || models[0] || '';
      this.connected = !!this.model;
      if (!models.length) {
        this.connectionError =
          'No local chat model found. Install one using Setup, then refresh.';
        this.setup = true;
      }
    } catch (error) {
      if (!this.destroyed && request === this.connection) {
        this.connectionError = this.errorText(error);
        this.setup = true;
      }
    } finally {
      if (!this.destroyed && request === this.connection)
        this.connecting = false;
    }
  }
  chooseTab(tab: 'chat' | 'medicines' | 'patients'): void {
    if (this.tab === tab) return;
    this.tab = tab;
    this.searchVersion++;
    this.query = '';
    this.results = [];
    this.searched = false;
    this.searching = false;
    this.searchError = '';
    this.scroll = true;
  }
  prompt(value: string): void {
    this.draft = value + ': ';
  }
  async send(): Promise<void> {
    if (this.sending || !this.connected) return;
    const question = this.draft.trim();
    if (!question || question.length > 4000) {
      this.chatError = 'Enter a question of up to 4,000 characters.';
      return;
    }
    this.messages.push({ role: 'user', content: question });
    this.draft = '';
    this.sending = true;
    this.chatError = '';
    this.scroll = true;
    const request = (this.request = new AbortController());
    try {
      const answer = await this.assistant.chat(
        this.model,
        this.messages,
        request.signal,
      );
      if (!this.destroyed && request === this.request) {
        this.messages.push({ role: 'assistant', content: answer });
        this.scroll = true;
      }
    } catch (error) {
      if (!this.destroyed && request === this.request) {
        this.messages.pop();
        this.draft = question;
        this.chatError = request.signal.aborted
          ? 'Response stopped. Your question is ready to send again.'
          : this.errorText(error);
      }
    } finally {
      if (!this.destroyed && request === this.request) this.sending = false;
    }
  }
  stop(): void {
    this.request?.abort();
  }
  clear(): void {
    if (
      !this.sending &&
      (!this.messages.length || window.confirm('Clear this conversation?'))
    ) {
      this.messages = [];
      this.chatError = '';
    }
  }
  modelChanged(): void {
    this.messages = [];
    this.chatError = '';
  }
  async search(): Promise<void> {
    if (this.tab === 'chat' || this.searching) return;
    const version = ++this.searchVersion;
    this.searching = true;
    this.results = [];
    this.searchError = '';
    this.searched = false;
    this.limit = 20;
    try {
      const results = await (this.tab === 'medicines'
        ? this.assistant.searchMedicines(this.query)
        : this.assistant.searchPatients(this.query));
      if (!this.destroyed && version === this.searchVersion) {
        this.results = results;
        this.searched = true;
      }
    } catch (error) {
      if (!this.destroyed && version === this.searchVersion)
        this.searchError = this.errorText(error);
    } finally {
      if (!this.destroyed && version === this.searchVersion)
        this.searching = false;
    }
  }
  trackMatch(_index: number, match: AssistantMatch): string {
    return match.key;
  }
  private errorText(error: unknown): string {
    return error instanceof Error
      ? error.message
      : 'Unable to complete the request. Please try again.';
  }
}
