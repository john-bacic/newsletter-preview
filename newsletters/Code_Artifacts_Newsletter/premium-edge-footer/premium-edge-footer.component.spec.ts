import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { PremiumEdgeFooterComponent } from './premium-edge-footer.component';
import { GlobalContentStore } from 'src/app/shared/store/global-content-store';
import { ObservableSubscriptionService } from 'src/app/shared/services/observable-subscription.service';
import { CommonService } from 'src/app/shared/services/common.service';
import { ContentService } from 'src/app/core/services/content.service';
import { PersistenceService } from 'src/app/core/services/persistence.service';
import { ContentStore } from 'src/app/shared/store/content-store';
import { of, Subject } from 'rxjs';
import { SimpleChanges, NO_ERRORS_SCHEMA } from '@angular/core';

describe('PremiumEdgeFooterComponent', () => {
  let component: PremiumEdgeFooterComponent;
  let fixture: ComponentFixture<PremiumEdgeFooterComponent>;
  let contentServiceSpy: jasmine.SpyObj<ContentService>;
  let commonServiceSpy: jasmine.SpyObj<CommonService>;
  let subscriptionServiceSpy: jasmine.SpyObj<ObservableSubscriptionService>;
  let openOrClosePEBenefitsSidebarSubject: Subject<any>;

  beforeEach(waitForAsync(() => {
    const contentSpy = jasmine.createSpyObj('ContentService', ['fetchContent']);
    const commonSpy = jasmine.createSpyObj('CommonService', ['isDesktop']);
    const subSpy = jasmine.createSpyObj('ObservableSubscriptionService', [], {
      openOrClosePEBenefitsSidebar: new Subject<any>()
    });

    TestBed.configureTestingModule({
      declarations: [PremiumEdgeFooterComponent],
      providers: [
        { provide: ContentService, useValue: contentSpy },
        { provide: CommonService, useValue: commonSpy },
        { provide: ObservableSubscriptionService, useValue: subSpy },
        { provide: GlobalContentStore, useValue: {} },
        { provide: PersistenceService, useValue: {} },
        { provide: ContentStore, useValue: {} }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    contentServiceSpy = TestBed.inject(ContentService) as jasmine.SpyObj<ContentService>;
    commonServiceSpy = TestBed.inject(CommonService) as jasmine.SpyObj<CommonService>;
    subscriptionServiceSpy = TestBed.inject(ObservableSubscriptionService) as jasmine.SpyObj<ObservableSubscriptionService>;
    openOrClosePEBenefitsSidebarSubject = subscriptionServiceSpy.openOrClosePEBenefitsSidebar as any as Subject<any>;
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PremiumEdgeFooterComponent);
    component = fixture.componentInstance;
    contentServiceSpy.fetchContent.and.returnValue(of({}));
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should fetch content', () => {
      const mockContent = { 
        name: 'test',
        lob: 'test',
        lang: 'en',
        text: 'test' 
      };
      contentServiceSpy.fetchContent.and.returnValue(of(mockContent));
      
      fixture.detectChanges();
      
      expect(contentServiceSpy.fetchContent).toHaveBeenCalledWith('premium-edge-ie');
      expect(component.peContent).toEqual(mockContent);
    });
  });

  describe('ngOnChanges', () => {
    it('should handle theme changes', () => {
      const changes: SimpleChanges = {
        theme: {
          previousValue: 'dark',
          currentValue: 'light',
          firstChange: false,
          isFirstChange: () => false
        }
      };
      component.ngOnChanges(changes);
      // No logic in ngOnChanges currently, just coverage
    });
  });

  describe('openSideDrawer', () => {
    it('should send true to openOrClosePEBenefitsSidebar if desktop', () => {
      commonServiceSpy.isDesktop.and.returnValue(true);
      spyOn(openOrClosePEBenefitsSidebarSubject, 'next');
      
      component.openSideDrawer();
      
      expect(openOrClosePEBenefitsSidebarSubject.next).toHaveBeenCalledWith(true);
    });

    it('should send "mobile" to openOrClosePEBenefitsSidebar if mobile', () => {
      commonServiceSpy.isDesktop.and.returnValue(false);
      spyOn(openOrClosePEBenefitsSidebarSubject, 'next');
      
      component.openSideDrawer();
      
      expect(openOrClosePEBenefitsSidebarSubject.next).toHaveBeenCalledWith('mobile');
    });
  });
});
