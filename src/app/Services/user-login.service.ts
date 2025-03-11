import { Injectable } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';

@Injectable({
  providedIn: 'root'
})
export class UserLoginService {
    private loggedIn: boolean;

    constructor(private cookie: CookieService){
        let temp=this.cookie.get('status');
        if(temp) this.loggedIn= (temp=="true")? true: false;
        else this.loggedIn= false;
    }

    SignIn(username: string, pass: string): boolean {
        let users = JSON.parse(localStorage.getItem('hospitalUsers') || '[]'); 
    
        let foundUser = users.find((user: any) => 
            user.username.toLowerCase() === username.toLowerCase() && 
            user.password.toLowerCase() === pass.toLowerCase()
        );
    
        if (foundUser) {
            console.log("for",foundUser)
            localStorage.setItem('loginUser',JSON.stringify(foundUser.username));
            
            this.loggedIn = true;
            this.cookie.set('status', 'true', 1);
            return true;
        }
    
        return false;
    }
    SignOut(){
        this.cookie.delete('status');
        this.loggedIn=false;
    }

    get status(){ return this.loggedIn; }

}
