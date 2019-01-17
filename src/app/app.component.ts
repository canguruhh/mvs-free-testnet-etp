import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { trigger, state, style, transition, animate } from '@angular/animations';


interface SendResponse {
  hash: string
}

interface HistoryItem {
  hash: string
  address: string
  date: Date
}

interface Balance {
  available: number
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass']
})
export class AppComponent {
  applyForm: FormGroup
  message: string
  balance: Balance
  transferCollection: AngularFirestoreCollection<HistoryItem>;
  history: Observable<HistoryItem[]>;

  address = new FormControl('')
  constructor(private http: HttpClient, afs: AngularFirestore) {
    afs.firestore.settings({ timestampsInSnapshots: false });
    this.transferCollection = afs.collection<HistoryItem>('transfer', ref => ref.orderBy('date', 'desc'));
    this.history = this.transferCollection.valueChanges()
  }

  ngOnInit() {
    // this.loadHistory()
    this.loadBalance()
    this.applyForm = new FormGroup({
      captcha: new FormControl(null, [
        Validators.required
      ]),
      email: new FormControl(null, [
        Validators.required,
        Validators.email
      ]),
      address: new FormControl(null, [
        Validators.required,
        Validators.pattern(/^t[A-Za-z0-9]{33}$/)
      ]),
    });
  }

  loadBalance(){
    this.http.get('/api/balance').subscribe((res:Balance) => {
      this.balance = res
    }, error => {
      console.error(error)
    })
  }

  // loadHistory(){
  //   this.http.get('/api/history').subscribe((res:HistoryItem[]) => {
  //     this.history = res
  //   }, error => {
  //     console.error(error)
  //   })
  // }

  onSubmit() {
    this.http.post('/api/send', this.applyForm.value).subscribe((res:SendResponse) => {
      this.message = `We send you some testnet ETP with transaction ${res.hash}. Go change the world!`
      console.log(res)
    }, res => {
      console.error(res)
      this.message = res.error
    })
  }


}
