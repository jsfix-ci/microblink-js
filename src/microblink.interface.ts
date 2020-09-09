import { Observable } from 'rxjs/internal/Observable'
import {
  ScanInputFile,
  ScanInputFrame,
  ScanListener,
  ScanOutput,
  ScanExchanger
} from './microblink.types'

export interface IMicroblink {
  ScanFile(scanInputFile: ScanInputFile, uploadProgress?: EventListener): Observable<ScanOutput>

  SendFile(scanInputFile: ScanInputFile, uploadProgress?: EventListener): void
  SendFrame(scanInputFrame: ScanInputFrame): void

  RegisterListener(scanListener: ScanListener): void

  SetRecognizers(recognizers: string | string[]): void
  GetRecognizers(): string | string[]
  SetAuthorization(authorizationHeader: string): void
  GetAuthorization(): string
  SetExportImages(exportImages: boolean | string | string[]): void
  SetExportFullDocumentImage(exportFullDocumentImage: boolean): void
  SetExportSignatureImage(exportSignatureImage: boolean): void
  SetExportFaceImage(exportFaceImage: boolean): void
  SetDetectGlare(detectGlare: boolean): void
  SetAllowBlurFilter(allowBlurFilter: boolean): void
  SetEndpoint(endpoint: string): void

  SetAnonymizeCardNumber(anonymizeCardNumber: boolean): void
  SetAnonymizeIban(anonymizeCard: boolean): void
  SetAnonymizeCvv(anonymizeCvv: boolean): void
  SetAnonymizeOwner(anonymizeOwner: boolean): void

  TerminateActiveRequests(): void

  SetUserId(userId: string): void
  SetIsDataPersistingEnabled(isEnabled: boolean): void

  CreateScanExchanger(scan: ScanExchanger, onUpdate: (scan: ScanExchanger) => void): any
  IsDesktopToMobileAvailable(): Promise<boolean>
  IsRecognizerArraySet(): boolean

  SetAnonymizeNetherlandsMrz(anonymizeNetherlandsMrz: boolean): void

  ActivateSaaS(activateSaaS: boolean): void
}
