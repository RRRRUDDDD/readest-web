export interface IAPProduct {
  id: string;
  title: string;
  description: string;
  price: string;
  priceCurrencyCode?: string;
  priceAmountMicros: number;
  productType?: 'consumable' | 'non_consumable' | 'subscription';
}

interface IAPPurchaseBase {
  productId: string;
  purchaseDate: string;
}

interface IOSPurchase {
  platform: 'ios';
  transactionId?: string;
  originalTransactionId?: string;
  packageName?: never;
  orderId?: never;
  purchaseToken?: never;
}

interface AndroidPurchase {
  platform: 'android';
  packageName?: string;
  orderId?: string;
  purchaseToken?: string;
  transactionId?: never;
  originalTransactionId?: never;
}

export type IAPPurchase = IAPPurchaseBase & (IOSPurchase | AndroidPurchase);

export class IAPService {
  static async isAvailable(): Promise<boolean> {
    return false;
  }

  async initialize(): Promise<boolean> {
    return false;
  }

  async fetchProducts(_productIds: string[]): Promise<IAPProduct[]> {
    return [];
  }

  async purchaseProduct(_productId: string): Promise<IAPPurchase> {
    throw new Error('In-app purchases are not supported in browser');
  }

  async restorePurchases(): Promise<IAPPurchase[]> {
    return [];
  }
}
