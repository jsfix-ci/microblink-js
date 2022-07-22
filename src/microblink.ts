// Import here Polyfills if needed. Recommended core-js (npm i -D core-js)
// import "core-js/fn/array.find"
// ...

// import { FrameHelper } from './frameHelper'
import { blobToBase64String } from 'blob-util'
import { IMicroblink } from './microblink.interface'
import { IMicroblinkApi } from './microblinkApi.interface'
import MicroblinkApi from './microblinkApi.service'
import { Observable } from 'rxjs/internal/Observable'
import { Observer } from 'rxjs'
import {
  ScanInputFile,
  ScanInputFrame,
  ScanListener,
  ScanOutput,
  StatusCodes,
  ScanInputFrameWithQuality,
  ScanExchanger,
  ScanExchangerCodes
} from './microblink.types'
import { FrameHelper } from './frameHelper'
import { ScanExchangeHelper } from './scanExchangeHelper'
import { CryptoHelper } from './cryptoHelper'

declare var firebase: any

export default class Microblink implements IMicroblink {
  private static fromHowManyFramesQualityCalculateBestFrame = 5

  private API: IMicroblinkApi
  private recognizers: string | string[] = []
  private authorizationHeader: string = ''
  private exportImages: boolean | string | string[] = false
  private exportFullDocumentImage: boolean = false
  private exportSignatureImage: boolean = false
  private exportFaceImage: boolean = false
  private detectGlare: boolean = false
  private allowBlurFilter: boolean = false
  private anonymizeNetherlandsMrz: boolean = false
  private anonymizeCardNumber: boolean = false
  private anonymizeIban: boolean = false
  private anonymizeCvv: boolean = false
  private anonymizeOwner: boolean = false
  private listeners: ScanListener[] = []
  private scanFrameQueue: ScanInputFrameWithQuality[] = []
  private endpoint: string = ''
  private saasIsActive: boolean = false

  constructor() {
    this.API = new MicroblinkApi()
  }

  /**
   * Terminate all active requests (pending responses)
   */
  TerminateActiveRequests(): void {
    this.API.TerminateAll()
    // Clear scan frame queue if it is not empty
    this.scanFrameQueue = []
  }

  /**
   * Register global success and/or error listener(s)
   */
  RegisterListener(scanListener: ScanListener): void {
    this.listeners.push(scanListener)
  }

  /**
   * Scan file and get result from subscribed observable
   */
  ScanFile(
    scanInputFile: ScanInputFile,
    uploadProgress?: EventListener | undefined
  ): Observable<ScanOutput> {
    return this.scan(scanInputFile.blob, true)
  }

  /**
   * Push file to SCAN queue, global listener(s) will handle the result
   */
  SendFile(scanInputFile: ScanInputFile, uploadProgress?: EventListener): void {
    // Call observable with empty callback because global listener will handle result
    // NOTE: error callback should be defined to handle Uncaught exception
    // tslint:disable-next-line:no-empty
    this.scan(scanInputFile.blob, true, uploadProgress).subscribe(
      () => {
        /** */
      },
      () => {
        /** */
      }
    )
  }

  /**
   * Push video frame to SCAN queue, global listener(s) will handle the result
   */
  SendFrame(scanInputFrame: ScanInputFrame): void {
    // Get frame quality estimatior
    const frameQuality = FrameHelper.getFrameQuality(scanInputFrame.pixelData)

    // Add the frame with quality to the scan queue
    this.scanFrameQueue.push({ frame: scanInputFrame, quality: frameQuality })

    // Skip finding of best frame if queue is not full with enough number of frames
    if (this.scanFrameQueue.length < Microblink.fromHowManyFramesQualityCalculateBestFrame) {
      return
    }

    // Find video frame with best quality
    let bestQuality = 0
    let bestFrame: ScanInputFrame | undefined
    this.scanFrameQueue.forEach(scanFrame => {
      if (scanFrame.quality > bestQuality) {
        bestQuality = scanFrame.quality
        bestFrame = scanFrame.frame
      }
    })

    // Clear scan frame queue
    this.scanFrameQueue = []

    if (bestFrame !== undefined) {
      // Call observable with empty callback because global listener will handle result
      // NOTE: error callback should be defined to handle Uncaught exception
      // tslint:disable-next-line:no-empty
      this.scan(bestFrame.blob, false).subscribe(
        () => {
          /** */
        },
        () => {
          /** */
        }
      )
    }
  }

  /**
   * Set recognizers which will be used in next SCAN(s)
   */
  SetRecognizers(recognizers: string | string[]): void {
    this.recognizers = recognizers

    let event = new CustomEvent('recognizersUpdated', {
      detail: { recognizers: this.recognizers },
      cancelable: true,
      bubbles: true
    })
    document.dispatchEvent(event)
  }

  /**
   * Get defined recognizers
   */
  GetRecognizers(): string | string[] {
    return this.recognizers
  }

  /**
   * Set authorization header value to authorize with https://api.microblink.com/recognize
   */
  SetAuthorization(authorizationHeader: string): void {
    this.authorizationHeader = authorizationHeader
    this.API.SetAuthorization(authorizationHeader)
  }

  /**
   * Get defined authorization header
   */
  GetAuthorization(): string {
    return this.authorizationHeader
  }

  /**
   * Change which images to export for next request
   * @param exportImages is either a boolean flag which describes whether API should return extracted images in next response or an array of API properties
   */
  SetExportImages(exportImages: boolean | string | string[]): void {
    this.exportImages = exportImages
    this.API.SetExportImages(exportImages)
  }

  /**
   * Change which images to export for next request
   * @param exportFullDocumentImage is a boolean flag which describes whether API should return extracted full document image in next response
   */
  SetExportFullDocumentImage(exportFullDocumentImage: boolean): void {
    this.exportFullDocumentImage = exportFullDocumentImage
    this.API.SetExportFullDocumentImage(exportFullDocumentImage)
  }

  /**
   * Change which images to export for next request
   * @param exportSignatureImage is a boolean flag which describes whether API should return extracted signature image in next response
   */
  SetExportSignatureImage(exportSignatureImage: boolean): void {
    this.exportSignatureImage = exportSignatureImage
    this.API.SetExportSignatureImage(exportSignatureImage)
  }

  /**
   * Change which images to export for next request
   * @param exportFaceImage is a boolean flag which describes whether API should return extracted face image in next response
   */
  SetExportFaceImage(exportFaceImage: boolean): void {
    this.exportFaceImage = exportFaceImage
    this.API.SetExportFaceImage(exportFaceImage)
  }

  /**
   * Set detect glare option for next request
   * @param detectGlare is a boolean flag which describes whether API should return null for image segments where glare is detected
   */
  SetDetectGlare(detectGlare: boolean): void {
    this.detectGlare = detectGlare
    this.API.SetDetectGlare(detectGlare)
  }

  /**
   * Set allow blur filter option for next request
   * @param allowBlurFilter is a boolean flag which describes whether API should return null for image segments where blur is detected
   */
  SetAllowBlurFilter(allowBlurFilter: boolean): void {
    this.allowBlurFilter = allowBlurFilter
    this.API.SetAllowBlurFilter(allowBlurFilter)
  }

  /**
   * Set endpoint for next SCAN(s)
   * Default value is https://api.microblink.com/recognize
   * Endpoint should be changed when backend proxy which is credentials keeper is using as proxy between
   * Microblink SaaS API and frontend application which uses this library.
   */
  SetEndpoint(endpoint: string): void {
    this.endpoint = endpoint
    this.API.SetEndpoint(endpoint)
  }

  /**
   * Set anonymize card number (works on BLINK_CARD recognizer) for next request
   * @param anonymizeCardNumber is a boolean flag which describes whether API should return a base64 image of the scanned card with the card number anonymized
   */
  SetAnonymizeCardNumber(anonymizeCardNumber: boolean): void {
    this.anonymizeCardNumber = anonymizeCardNumber
    this.API.SetAnonymizeCardNumber(anonymizeCardNumber)
  }

  /**
   * Set anonymize IBAN (works on BLINK_CARD recognizer) for next request
   * @param anonymizeIbanNumber is a boolean flag which describes whether API should return a base64 image of the scanned card with the IBAN number anonymized
   */
  SetAnonymizeIban(anonymizeIban: boolean): void {
    this.anonymizeIban = anonymizeIban
    this.API.SetAnonymizeIban(anonymizeIban)
  }

  /**
   * Set anonymize cvv (works on BLINK_CARD recognizer) for next request
   * @param anonymizeCvv is a boolean flag which describes whether API should return a base64 image of the scanned card with the cvv number anonymized
   */
  SetAnonymizeCvv(anonymizeCvv: boolean): void {
    this.anonymizeCvv = anonymizeCvv
    this.API.SetAnonymizeCvv(anonymizeCvv)
  }

  /**
   * Set anonymize owner (works on BLINK_CARD recognizer) for next request
   * @param anonymizeOwner is a boolean flag which describes whether API should return a base64 image of the scanned card with the owner name anonymized
   */
  SetAnonymizeOwner(anonymizeOwner: boolean): void {
    this.anonymizeOwner = anonymizeOwner
    this.API.SetAnonymizeOwner(anonymizeOwner)
  }

  /**
   * Set user identificator which will be stored with uploaded image
   * @param userId is any string which unique identifies user who use SDK and upload any image to API
   */
  SetUserId(userId: string): void {
    this.API.SetUserId(userId)
  }

  /**
   * When Authorization is not set it is available to disable persiting of uploaded data, by default it is enabled
   * this should be disabled for every page where GDPR is not implemented and this is ability to disable data persisting
   * on some demo pages
   * @param isEnabled is flag which describes should or should not API persist uploaded data, be default it is enabled
   */
  SetIsDataPersistingEnabled(isEnabled: boolean): void {
    this.API.SetIsDataPersistingEnabled(isEnabled)
  }

  /**
   * Set anonymize netherlandsMrz (works on BLINK_CARD recognizer) for next request
   * @param anonymizeNetherlandsMrz is a boolean flag which describes whether API should return a base64 image of the scanned card with the netherlands MRZ anonymized
   */
  SetAnonymizeNetherlandsMrz(anonymizeNetherlandsMrz: boolean): void {
    this.anonymizeNetherlandsMrz = anonymizeNetherlandsMrz
    this.API.SetAnonymizeNetherlandsMrz(anonymizeNetherlandsMrz)
  }

  /**
   * Check is all requirement for desktop-to-mobile feature are available
   */
  async IsDesktopToMobileAvailable(): Promise<boolean> {
    return this.isDesktopToMobileAvailable()
  }

  ActivateSaaS(activateSaaS: boolean): void {
    this.saasIsActive = activateSaaS
    this.API.ActivateSaaS(activateSaaS)
  }

  /**
   * Check if any recognizer is set in the recognizers array
   */
  IsRecognizerArraySet(): boolean {
    if (this.recognizers) {
      if (this.recognizers.constructor === Array) {
        if (this.recognizers.length > 0) {
          return true
        } else {
          return false
        }
      }
      return true
    }
    return false
  }

  /**
   * Create object for exchange data for scan between devices
   * @param data is object with optional data which will be added to the ScanExchanger object
   */
  async CreateScanExchanger(
    data: ScanExchanger,
    onChange: (data: ScanExchanger) => void
  ): Promise<any> {
    // Get recognizers, authorizationHeader, images to export, and glare detection option from remote request
    data.recognizers = this.recognizers
    data.authorizationHeader = this.authorizationHeader // it is encrypted
    data.exportImages = this.exportImages
    data.exportFullDocumentImage = this.exportFullDocumentImage
    data.exportSignatureImage = this.exportSignatureImage
    data.exportFaceImage = this.exportFaceImage
    data.detectGlare = this.detectGlare
    data.allowBlurFilter = this.allowBlurFilter
    data.anonymizeCardNumber = this.anonymizeCardNumber
    data.anonymizeIban = this.anonymizeIban
    data.anonymizeCvv = this.anonymizeCvv
    data.anonymizeOwner = this.anonymizeOwner
    data.endpoint = this.endpoint
    data.anonymizeNetherlandsMrz = this.anonymizeNetherlandsMrz
    data.saasIsActive = this.saasIsActive

    // Generate Secret key
    // Generate random 32 long string
    const secretKey = CryptoHelper.randomString(32)
    // Key should be part of object during creating shortUrl, Firebase Function will read key, generate link
    // and delete key set in plain string
    data.key = secretKey

    // Encrypt authorizationHeader
    data.authorizationHeader = CryptoHelper.encrypt(data.authorizationHeader, secretKey)

    // Create exchange object at Firestore
    const scanAsPromise = ScanExchangeHelper.createScanExchanger(data)

    // Fetch exchange object
    const scan: any = await scanAsPromise

    // Listen for data from Firestore
    const unsubscribe = scan.onSnapshot(async (scanDoc: any) => {
      // Get data as JSON
      const scanDocData = scanDoc.data()

      // if (scanDocData.status === ScanExchangerCodes.Step01_RemoteCameraIsRequested) {
      // }

      if (
        scanDocData.status === ScanExchangerCodes.Step02_ExchangeLinkIsGenerated &&
        scanDocData.shortLink
      ) {
        const qrCodeAsBase64 = await ScanExchangeHelper.generateQRCode(scanDocData.shortLink)
        scanDocData.qrCodeAsBase64 = qrCodeAsBase64
      }

      if (
        scanDocData.status === ScanExchangerCodes.Step07_ResultIsAvailable &&
        (scanDocData.result || scanDocData.resultUrl)
      ) {
        let scanResultDec
        if (scanDocData.result) {
          scanResultDec = CryptoHelper.decrypt(scanDocData.result, secretKey)
        } else if (scanDocData.resultUrl) {
          const resultUrl = CryptoHelper.decrypt(scanDocData.resultUrl, secretKey)
          const response = await fetch(resultUrl)
          const blob = await response.blob()
          const text = await blobToBase64String(blob)
          scanDocData.result = text
          scanResultDec = CryptoHelper.decrypt(text, secretKey)
          firebase
            .storage()
            .refFromURL(resultUrl)
            .delete()
        }
        // Notify success listeners
        this.notifyOnSuccessListeners({ result: scanResultDec, sourceBlob: null }, true)

        // After successfully read 'result', remove it from the Firestore
        scan.update({
          result: null,
          resultUrl: null
        })

        // External integrator should decide when to unsubscribe!
        // On Successful results, stop listening to changes
        // unsubscribe()
      }

      // Error handling
      if (scanDocData.status === ScanExchangerCodes.ErrorHappened && scanDocData.error) {
        // Notify error listeners
        this.notifyOnErrorListeners(scanDocData.error)
      }

      // Send onUpdate callback
      onChange(scanDocData)
    })

    // Return scan object subscription to enable external unsubscribe
    return unsubscribe
  }

  private async isDesktopToMobileAvailable() {
    try {
      // Try to fetch any document
      await firebase
        .app()
        .firestore()
        .doc('scans/any-document')
        .get()
    } catch (err) {
      // Only if Firestore is not available then desktop-to-mobile is not available
      if (err.name === 'FirebaseError' && err.code === 'unavailable') {
        /*
        console.error(
          'Microblink.SDK: feature desktop-to-mobile is not available because connection to the Firebase.Firestore is not available!'
        )
        */
        return false
      } else {
        // console.log('IsDesktopToMobileAvailable.error', err)
      }
    }
    return true
  }

  /**
   * Notify all global listeners when success scan is complete
   */
  private notifyOnSuccessListeners(scanOutput: ScanOutput, isFileScan: boolean): void {
    const data: any = this.saasIsActive ? scanOutput : scanOutput.result.data
    let isSuccessfulResponse = false

    // check if it is fetched data array of results
    if (Array.isArray(data)) {
      data.forEach(resultItem => {
        if (resultItem.result) {
          isSuccessfulResponse = true
        }
      })
    } else {
      // otherwise it is returned result as object
      const result = this.saasIsActive ? data.result.result : data.result
      if (result) {
        isSuccessfulResponse = true
      }
    }

    // when success response is received then terminate active requests and return results
    if (isSuccessfulResponse || isFileScan) {
      // Active requests can only exists if it is video frame scan
      if (!isFileScan) {
        this.TerminateActiveRequests()
      }

      this.listeners.forEach(listener => {
        if (listener.onScanSuccess) {
          listener.onScanSuccess(scanOutput)
        }
      })
    }
  }

  /**
   * Notify all global listeners when error happens, HTTP response status code is not equal to 200 or
   * base64 encode failed
   */
  private notifyOnErrorListeners(err: any): void {
    this.TerminateActiveRequests()

    // Make silent if JSON is not prasable because this error will happen when request is aborted
    if (err.code === StatusCodes.ResultIsNotValidJSON) {
      return
    }

    this.listeners.forEach(listener => {
      if (listener.onScanError) {
        listener.onScanError(err)
      }
    })
  }

  /**
   * Execute scan on Microblink API service
   */
  private scan(
    blob: Blob,
    isFileScan: boolean,
    uploadProgress?: EventListener
  ): Observable<ScanOutput> {
    return new Observable((observer: Observer<ScanOutput>) => {
      blobToBase64String(blob)
        .then(blobAsBase64String => {
          this.API.Recognize(this.recognizers, blobAsBase64String, uploadProgress).subscribe(
            result => {
              const output = { sourceBlob: blob, result: result }
              this.notifyOnSuccessListeners(output, isFileScan)
              observer.next(output)
              observer.complete()
            },
            err => {
              if (err) {
                this.notifyOnErrorListeners(err)
                observer.error(err)
              }
            }
          )
        })
        .catch(err => {
          this.notifyOnErrorListeners(err)
          observer.error(err)
        })
    })
  }
}
