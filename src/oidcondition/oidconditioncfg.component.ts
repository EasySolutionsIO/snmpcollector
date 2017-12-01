import { Component, ChangeDetectionStrategy, ViewChild  } from '@angular/core';
import { FormBuilder, Validators} from '@angular/forms';
import { OidConditionService } from './oidconditioncfg.service';
import { ControlMessagesComponent } from '../common/control-messages.component'
import { ValidationService } from '../common/validation.service'
import { FormArray, FormGroup, FormControl} from '@angular/forms';
import { TypeaheadModule } from 'ngx-bootstrap/typeahead';
import { ExportFileModal } from '../common/dataservice/export-file-modal';
import { Observable } from 'rxjs/Rx';

import { GenericModal } from '../common/generic-modal';
import { ExportServiceCfg } from '../common/dataservice/export.service'
import { ItemsPerPageOptions } from '../common/global-constants';

import { TableActions } from '../common/table-actions';
import { AvailableTableActions } from '../common/table-available-actions';

declare var _:any;

@Component({
  selector: 'oidconditions',
  providers: [OidConditionService],
  templateUrl: './oidconditioneditor.html',
  styleUrls: ['../css/component-styles.css']
})

export class OidConditionCfgComponent {
  @ViewChild('viewModal') public viewModal: GenericModal;
  @ViewChild('viewModalDelete') public viewModalDelete: GenericModal;
  @ViewChild('exportFileModal') public exportFileModal : ExportFileModal;


  editEnabled : boolean = false;
  selectedArray : any = [];
  public isRequesting : boolean;
  public counterItems : number = null;
  public counterErrors: any = [];

  itemsPerPageOptions : any = ItemsPerPageOptions;
  editmode: string; //list , create, modify
  oidconditions: Array<any>;
  filter: string;
  oidconditionForm: any;
  myFilterValue: any;

  //Initialization data, rows, colunms for Table
  private data: Array<any> = [];
  public rows: Array<any> = [];
  public columns: Array<any> = [
    { title: 'ID', name: 'ID' },
    { title: 'Is Multiple', name: 'IsMultiple' },
    { title: 'OIDCond', name: 'OIDCond' },
    { title: 'CondType', name: 'CondType' },
    { title: 'CondValue', name: 'CondValue' }
  ];

  public tableAvailableActions : any;
  public page: number = 1;
  public itemsPerPage: number = 20;
  public maxSize: number = 5;
  public numPages: number = 1;
  public length: number = 0;
  private builder;
  private oldID : string;
  //Set config
  public config: any = {
    paging: true,
    sorting: { columns: this.columns },
    filtering: { filterString: '' },
    className: ['table-striped', 'table-bordered']
  };

  constructor(public oidConditionService: OidConditionService, public exportServiceCfg : ExportServiceCfg, builder: FormBuilder) {
    this.editmode = 'list';
    this.reloadData();
    this.builder = builder;
  }

  enableEdit() {
    this.editEnabled = !this.editEnabled;
    console.log(this.editEnabled);
    let obsArray = [];
    this.tableAvailableActions = new AvailableTableActions('oidcondition').availableOptions;
  }

  createStaticForm() {
    this.oidconditionForm = this.builder.group({
      ID: [this.oidconditionForm ? this.oidconditionForm.value.ID : '', Validators.required],
      IsMultiple: [this.oidconditionForm ? this.oidconditionForm.value.IsMultiple : 'false',Validators.required],
      Description: [this.oidconditionForm ? this.oidconditionForm.value.Description : '']
    });
  }

  createDynamicForm(fieldsArray: any) : void {
    //Saves the actual to check later if there are shared values
    let tmpform : any;
    if (this.oidconditionForm)  tmpform = this.oidconditionForm.value;
    this.createStaticForm();

    for (let entry of fieldsArray) {
      let value = entry.defVal;
      //Check if there are common values from the previous selected item
      if (tmpform) {
        if (tmpform[entry.ID] && entry.override !== true) {
          value = tmpform[entry.ID];
        }
      }
      //Set different controls:
      this.oidconditionForm.addControl(entry.ID, new FormControl(value, entry.Validators));
    }
  }

  setDynamicFields (field : any, override? : boolean) : void  {
    //Saves on the array all values to push into formGroup
    let controlArray : Array<any> = [];
    console.log(field);
    switch (field) {
      case 'true':
      case true:
        controlArray.push({'ID': 'OIDCond', 'defVal' : '', 'Validators' : Validators.required, 'override' : override});
        break;
      default:
        controlArray.push({'ID': 'OIDCond', 'defVal' : '', 'Validators' : Validators.compose([ValidationService.OIDValidator, Validators.required]), 'override' : override});
        controlArray.push({'ID': 'CondType', 'defVal' : 'match', 'Validators' : Validators.required });
        controlArray.push({'ID': 'CondValue', 'defVal' : '', 'Validators' : Validators.required });
        break;
    }
    //Reload the formGroup with new values saved on controlArray
    this.createDynamicForm(controlArray);
  }

  reloadData() {
    this.selectedArray = [];
    this.isRequesting = true;
    // now it's a simple subscription to the observable
    this.oidConditionService.getConditions(null)
      .subscribe(
      data => {
        this.isRequesting = false;
        this.oidconditions = data;
        this.data = data;
        this.onChangeTable(this.config);
      },
      err => console.error(err),
      () => console.log('DONE')
      );
  }

  onResetFilter() : void {
    this.page = 1;
    this.myFilterValue = "";
    this.config.filtering = {filtering: { filterString: '' }};
    this.onChangeTable(this.config);
  }

  applyAction(test : any) : void {
    switch(test.action) {
       case "RemoveAllSelected": {
          this.removeAllSelectedItems(this.selectedArray);
          break;
       }
       default: {
          break;
       }
    }
  }

  public changePage(page: any, data: Array<any> = this.data): Array<any> {
    //Check if we have to change the actual page
    let maxPage =  Math.ceil(data.length/this.itemsPerPage);
    if (page.page > maxPage && page.page != 1) this.page = page.page = maxPage;

    let start = (page.page - 1) * page.itemsPerPage;
    let end = page.itemsPerPage > -1 ? (start + page.itemsPerPage) : data.length;
    return data.slice(start, end);
  }

  public changeSort(data: any, config: any): any {
    if (!config.sorting) {
      return data;
    }

    let columns = this.config.sorting.columns || [];
    let columnName: string = void 0;
    let sort: string = void 0;

    for (let i = 0; i < columns.length; i++) {
      if (columns[i].sort !== '' && columns[i].sort !== false) {
        columnName = columns[i].name;
        sort = columns[i].sort;
      }
    }

    if (!columnName) {
      return data;
    }

    // simple sorting
    return data.sort((previous: any, current: any) => {
      if (previous[columnName] > current[columnName]) {
        return sort === 'desc' ? -1 : 1;
      } else if (previous[columnName] < current[columnName]) {
        return sort === 'asc' ? -1 : 1;
      }
      return 0;
    });
  }

  public changeFilter(data: any, config: any): any {
    let filteredData: Array<any> = data;
    this.columns.forEach((column: any) => {
      if (column.filtering) {
        filteredData = filteredData.filter((item: any) => {
          return item[column.name].match(column.filtering.filterString);
        });
      }
    });

    if (!config.filtering) {
      return filteredData;
    }

    if (config.filtering.columnName) {
      return filteredData.filter((item: any) =>
        item[config.filtering.columnName].match(this.config.filtering.filterString));
    }

    let tempArray: Array<any> = [];
    filteredData.forEach((item: any) => {
      let flag = false;
      this.columns.forEach((column: any) => {
        if (item[column.name] === null) {
          item[column.name] = '--'
        }
        if (item[column.name].toString().match(this.config.filtering.filterString)) {
          flag = true;
        }

      });
      if (flag) {
        tempArray.push(item);
      }
    });
    filteredData = tempArray;

    return filteredData;
  }

  changeItemsPerPage (items) {
    this.itemsPerPage = parseInt(items);
    let maxPage =  Math.ceil(this.length/this.itemsPerPage);
    if (this.page > maxPage) this.page = maxPage;
    this.onChangeTable(this.config);
  }

  public onChangeTable(config: any, page: any = { page: this.page, itemsPerPage: this.itemsPerPage }): any {
    if (config.filtering) {
      Object.assign(this.config.filtering, config.filtering);
    }
    if (config.sorting) {
      Object.assign(this.config.sorting, config.sorting);
    }
    let filteredData = this.changeFilter(this.data, this.config);
    let sortedData = this.changeSort(filteredData, this.config);
    this.rows = page && config.paging ? this.changePage(page, sortedData) : sortedData;
    this.length = sortedData.length;
  }

  onFilter() {
    this.reloadData();
  }

  viewItem(id, event) {
    console.log('view', id);
    this.viewModal.parseObject(id);

  }

  exportItem(item : any) : void {
    this.exportFileModal.initExportModal(item);
  }

  removeAllSelectedItems(myArray) {
    let obsArray = [];
    this.counterItems = 0;
    this.isRequesting = true;
    for (let i in myArray) {
      console.log("Removing ",myArray[i].ID)
      this.deleteOidCondition(myArray[i].ID,true);
      obsArray.push(this.deleteOidCondition(myArray[i].ID,true));
    }
    this.genericForkJoin(obsArray);
  }

  removeItem(row) {
    let id = row.ID;
    console.log('remove', id);
    this.oidConditionService.checkOnDeleteCondition(id)
      .subscribe(
      data => {
        console.log(data);
        let temp = data;
        this.viewModalDelete.parseObject(temp)
      },
      err => console.error(err),
      () => { }
      );
  }
  newOidCondition() {
    if (this.oidconditionForm) {
      this.setDynamicFields(this.oidconditionForm.value.IsMultiple);
    } else {
      this.setDynamicFields(null);
    }
    this.editmode = "create";
  }

  editOidCondition(row) {
    let id = row.ID;
    this.oidConditionService.getConditionsById(id)
      .subscribe(data => {
        this.oidconditionForm = {};
        this.oidconditionForm.value = data;
        this.setDynamicFields(row.IsMultiple, false);
        this.oldID = data.ID
        this.editmode = "modify"
       },
      err => console.error(err)
      );
  }
  deleteOidCondition(id, recursive?) {
    if (!recursive) {
      this.oidConditionService.deleteCondition(id)
      .subscribe(data => { },
      err => console.error(err),
      () => { this.viewModalDelete.hide(); this.editmode = "list"; this.reloadData() }
      );
    } else {
      return this.oidConditionService.deleteCondition(id, true)
      .do(
        (test) =>  { this.counterItems++},
        (err) => { this.counterErrors.push({'ID': id, 'error' : err})}
      );
    }
  }

  cancelEdit() {
    this.editmode = "list";
  }

  saveOidCondition() {
    if (this.oidconditionForm.valid) {
      this.oidConditionService.addCondition(this.oidconditionForm.value)
        .subscribe(data => { console.log(data) },
        err => console.error(err),
        () => { this.editmode = "list"; this.reloadData() }
        );
    }
  }

  updateAllSelectedItems(mySelectedArray,field,value, append?) {
    let obsArray = [];
    this.counterItems = 0;
    this.isRequesting = true;
    if (!append)
    for (let component of mySelectedArray) {
      component[field] = value;
      obsArray.push(this.updateOidCondition(true,component));
    } else {
      let tmpArray = [];
      if(!Array.isArray(value)) value = value.split(',');
      console.log(value);
      for (let component of mySelectedArray) {
        console.log(value);
        //check if there is some new object to append
        let newEntries = _.differenceWith(value,component[field],_.isEqual);
        tmpArray = newEntries.concat(component[field])
        console.log(tmpArray);
        component[field] = tmpArray;
        obsArray.push(this.updateOidCondition(true,component));
      }
    }
    this.genericForkJoin(obsArray);
    //Make sync calls and wait the result
    this.counterErrors = [];
  }

  updateOidCondition(recursive?, component?) {
    if (!recursive) {
      if (this.oidconditionForm.valid) {
        var r = true;
        if (this.oidconditionForm.value.ID != this.oldID) {
          r = confirm("Changing Condition ID from " + this.oldID + " to " + this.oidconditionForm.value.ID + ". Proceed?");
        }
        if (r == true) {
          this.oidConditionService.editCondition(this.oidconditionForm.value, this.oldID)
            .subscribe(data => { console.log(data) },
            err => console.error(err),
            () => { this.editmode = "list"; this.reloadData() }
            );
        }
      }
    } else {
      return this.oidConditionService.editCondition(component, component.ID, true)
      .do(
        (test) =>  { this.counterItems++ },
        (err) => { this.counterErrors.push({'ID': component['ID'], 'error' : err['_body']})}
      )
      .catch((err) => {
        return Observable.of({'ID': component.ID , 'error': err['_body']})
      })
    }
  }

  genericForkJoin(obsArray: any) {
    Observable.forkJoin(obsArray)
              .subscribe(
                data => {
                  this.selectedArray = [];
                  this.reloadData()
                },
                err => console.error(err),
              );
  }
}
