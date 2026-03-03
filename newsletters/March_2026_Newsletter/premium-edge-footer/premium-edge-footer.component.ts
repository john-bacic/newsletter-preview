import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, style, animate, transition } from '@angular/animations';
import { GlobalContentStore } from 'src/app/shared/store/global-content-store';
import { ObservableSubscriptionService } from 'src/app/shared/services/observable-subscription.service';
import { CommonService } from 'src/app/shared/services/common.service';
import { ContentService } from 'src/app/core/services/content.service';
import { PersistenceService } from 'src/app/core/services/persistence.service';
import { Subscription } from 'rxjs';
import { ContentStore } from 'src/app/shared/store/content-store';

@Component({
  selector: 'app-premium-edge-footer',
  templateUrl: './premium-edge-footer.component.html',
  styleUrls: ["./premium-edge-footer.component.scss"],
  standalone: false
})
export class PremiumEdgeFooterComponent implements OnChanges {
    @Input() theme: string;
    @Input() content: any;
  
    subscriptions = new Subscription();

  

     constructor(public globalContent: GlobalContentStore,
    public subscriptionService: ObservableSubscriptionService,
    public commonService: CommonService,
    public persistenceService: PersistenceService,
    public contentService: ContentService,
    public peContent: ContentStore,) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['theme']) {
      // Theme changed from parent drawer
    }
  }

  ngOnInit() {
   this.subscriptions.add(
      this.contentService.fetchContent("premium-edge-ie").subscribe((data) => {
        if (data) {
          this.peContent = data;
          // this.excontent =this.peContent.text?.eContent;
       
        }
      })
    );

}
openSideDrawer(){
  if (this.commonService.isDesktop()) {
    // Desktop: Use observable pattern for sidebar-launcher
    this.subscriptionService.openOrClosePEBenefitsSidebar.next(true);
  } else {
    // Mobile: Use observable pattern for footer's embedded sidebar
    this.subscriptionService.openOrClosePEBenefitsSidebar.next('mobile');
  }
}
}
