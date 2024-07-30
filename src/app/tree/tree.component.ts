import { CommonModule } from "@angular/common";
import { Component, inject, OnInit, signal } from "@angular/core";
import { OfVirtualTreeModule } from "./of-tree.module";
import { HttpClient } from "@angular/common/http";

export interface ITreeItem {
    name: string;
    type: 'f' | 'd';
    children: ITreeItem[];
}

@Component({
    selector: 'vt-tree',
    standalone: true,
    imports: [CommonModule, OfVirtualTreeModule],
    templateUrl: './tree.component.html',
    styleUrl: './tree.component.scss'
})
export class TreeComponent implements OnInit {
    public treeData = signal<ITreeItem[]>([]);
    private http = inject(HttpClient);
    public loading: boolean = false;
    public selected: any;
    public filterText: string = '';
    public config = {
        filterThrottle: 1,
        filterTextMinLength: 0
    };

    ngOnInit(): void {
        this.http.get<ITreeItem[]>('data.json').subscribe(
            data => this.treeData.set(data)
        );
    }
}