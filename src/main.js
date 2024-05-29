import './assets/main.css'
import { createApp } from 'vue'
import App from './App.vue'
// svg封装插件
import SvgIcon from "@/components/SvgIcon.vue"
import "virtual:svg-icons-register"                

createApp(App).component("svg-icon", SvgIcon).mount('#app')
