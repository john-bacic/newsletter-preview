import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ContentService } from 'src/app/core/services/content.service';
import { AppStore } from 'src/app/shared/models/app-store';
import { CommonService } from 'src/app/shared/services/common.service';
import { openWindow } from 'src/app/shared/services/utils.service';

@Component({
  selector: 'app-pe-newsletter-mar26',
  templateUrl: './pe-newsletter-mar26.component.html',
  styleUrls: ['./pe-newsletter-mar26.component.scss'],
  standalone: false
})
export class PeNewsletterMar26Component implements OnInit, OnDestroy  {
 subscriptions = new Subscription();
  newsletterContent: any;

  constructor(
    private contentService: ContentService,
    public appStore: AppStore,
    public commonService: CommonService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.contentService.fetchContent('pe-newsletter-mar26').subscribe((data) => {
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

  openQuadrupleWitchingLink() {
    const url = this.appStore.lang.toUpperCase() === 'EN'
      ? 'https://www.investorsedge.cibc.com/en/learn/investing/getting-started/quadruple-witching.html'
      : 'https://www.investorsedge.cibc.com/fr/learn/investing/getting-started/quadruple-witching.html';

    if (this.appStore.isApp()) {
      openWindow(url, this.appStore);
    } else {
      window.open(url, '_blank');
    }
  }

  openWebinarLink() {
    const url = this.appStore.lang.toUpperCase() === 'EN'
      ? 'https://cibcvirtual.com/InvestorsEdgeWebinars2026/'
      : 'https://cibcvirtual.com/InvestorsEdgeWebinars2026';

    if (this.appStore.isApp()) {
      openWindow(url, this.appStore);
    } else {
      window.open(url, '_blank');
    }
  }

  learnMore() {
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
