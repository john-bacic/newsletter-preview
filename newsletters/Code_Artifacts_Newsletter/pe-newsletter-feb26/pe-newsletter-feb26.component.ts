import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ContentService } from 'src/app/core/services/content.service';
import { AppStore } from 'src/app/shared/models/app-store';
import { CommonService } from 'src/app/shared/services/common.service';
import { openWindow } from 'src/app/shared/services/utils.service';

@Component({
  selector: 'app-pe-newsletter-feb26',
  templateUrl: './pe-newsletter-feb26.component.html',
  styleUrls: ['./pe-newsletter-feb26.component.scss'],
  standalone: false
})
export class PeNewsletterFeb26Component implements OnInit, OnDestroy  {
 subscriptions = new Subscription();
  newsletterContent: any;

  constructor(
    private contentService: ContentService,
    public appStore: AppStore,
    public commonService: CommonService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.contentService.fetchContent('pe-newsletter-feb26').subscribe((data) => {
        if (data) {
          this.newsletterContent = data;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  openLink(url: string): void {
    if (!url) {
      return;
    }

    if (this.appStore.isApp()) {
      openWindow(url, this.appStore);
    } else {
      window.open(url, '_blank');
    }
  }

  get isMobile(): boolean {
    return !this.commonService.isDesktop();
  }

    openConditionsApplyLink() {
    const url = this.appStore.lang.toUpperCase() === 'EN'
      ? 'https://events.teams.microsoft.com/event/6c9f4eca-11fc-4abc-a997-6d5d2a39ef49@df2a9a6b-e42f-47b2-9ebd-6ce7a612e4f5'
      : 'https://events.teams.microsoft.com/event/6c9f4eca-11fc-4abc-a997-6d5d2a39ef49@df2a9a6b-e42f-47b2-9ebd-6ce7a612e4f5';
    
    if (this.appStore.isApp()) {
      openWindow(url, this.appStore);
    } else {
      window.open(url, '_blank');
    }
  }


  LearnQEandQT() {
    const url = this.appStore.lang.toUpperCase() === 'EN'
      ? 'https://www.investorsedge.cibc.com/en/learn/investing/portfolio-strategies/quantitative-easing-vs-tightening.html'
      : 'https://www.investorsedge.cibc.com/fr/learn/investing/portfolio-strategies/quantitative-easing-vs-tightening.html';
    
    if (this.appStore.isApp()) {
      openWindow(url, this.appStore);
    } else {
      window.open(url, '_blank');
    }
  }

  openLinkWebinar(){
       const url = this.appStore.lang.toUpperCase() === 'EN'
      ? 'https://cibcvirtual.com/InvestorsEdgeWebinars2026/'
      : 'https://cibcvirtual.com/InvestorsEdgeWebinars2026';
    
    if (this.appStore.isApp()) {
      openWindow(url, this.appStore);
    } else {
      window.open(url, '_blank');
    }
  }


  learnMore(){
       const url = this.appStore.lang.toUpperCase() === 'EN'
      ? 'https://www.investorsedge.cibc.com/en/special-offers/start-trading.html'
      : 'https://www.investorsedge.cibc.com/fr/special-offers/start-trading.html';
    
    if (this.appStore.isApp()) {
      openWindow(url, this.appStore);
    } else {
      window.open(url, '_blank');
    }
  }
}
