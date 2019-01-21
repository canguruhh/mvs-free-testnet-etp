import { Component, OnInit } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/firestore';
import { Observable } from 'rxjs'

interface HistoryItem {
  hash: string
  address: string
  date: Date
}

@Component({
  selector: 'history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.sass']
})
export class HistoryComponent implements OnInit {

  history: Observable<HistoryItem[]>;
  transferCollection: AngularFirestoreCollection<HistoryItem>;

  constructor(afs: AngularFirestore) {
    afs.firestore.settings({ timestampsInSnapshots: false });
    this.transferCollection = afs.collection<HistoryItem>('transfer', ref => ref.orderBy('date', 'desc'));
    this.history = this.transferCollection.valueChanges()
  }

  ngOnInit() {
  }

}
