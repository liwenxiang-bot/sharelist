<template>
  <n-global-style />
  <n-card class="notice" size="small" :style="theme()">
    <n-switch
      :default-value="isDarkTheme"
      @update:value="(v) => $emit('changeIsDarkTheme', v)"
      size="small"
    >
      <template #checked-icon>
        <n-icon :component="Sparkles" />
      </template>
      <template #unchecked-icon>
        <n-icon :component="SunnySharp" />
      </template>
    </n-switch>
    <div v-html="notice"></div>
  </n-card>

  <n-grid
    x-gap="10"
    y-gap="10"
    cols="2 s:3 m:4 l:5 xl:5 2xl:6"
    responsive="screen"
  >
    <n-grid-item class="cardclss" v-for="item in itemslist" :key="item.carID">
      <n-card
        size="small"
        @click="redirectTo(item.carID)"
      >
        <div
          class="type"
          :style="{ background: item.labelColor }"
        >
          {{ item.label != "" ? item.label : "NO" }}
        </div>

        <div class="cartitle">
          <n-text class="title">{{ item.carID }}</n-text>
        </div>

        <div class="message-with-dot">实时状态：{{ item.message }}</div>

        <div :style="{ width: '100%' }">
          <a-progress
            :show-text="false"
            :steps="4"
            :color="item.color"
            :percent="item.bai"
            trackColor="rgb(var(--green-4))"
            stroke-width="30"
          />
        </div>
      </n-card>
    </n-grid-item>
  </n-grid>

  <n-divider
    dashed
    title-placement="center"
    style="font-size: 14px"
    v-if="itemslist.length < total"
  >
    上拉加载更多
  </n-divider>
  <n-back-top :right="20" :bottom="20" />
</template>
<script lang="ts">
function uniqueArrayObjects(arr) {
  const jsonObjectSet = new Set();
  const uniqueArray = [];

  arr.forEach((item) => {
    const jsonString = JSON.stringify(item);
    if (!jsonObjectSet.has(jsonString)) {
      jsonObjectSet.add(jsonString);
      uniqueArray.push(item);
    }
  });

  return uniqueArray;
}

const isDev = import.meta.env.MODE === "development";

import axios from "axios";
import { useLoadingBar } from "naive-ui";
import { Sparkles, SunnySharp } from "@vicons/ionicons5";

export default {
  props: {
    isDarkTheme: {
      type: Boolean,
      default: false,
    },
  },
  components: {},
  data() {
    return {
      itemslist: [],
      itemsplus: [],
      notice: "",
      total: 0,
      page: 1,
      isLoading: false,
      hasMoreData: true,
      minPage: 50,
      loadingBar: null,
    };
  },
  computed: {
    Sparkles() {
      return Sparkles;
    },
    SunnySharp() {
      return SunnySharp;
    },
  },
  mounted() {
    this.fetchData();
    window.addEventListener("scroll", this.handleScroll);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  },

  beforeDestroy() {
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange
    );
  },

  methods: {
    handleVisibilityChange() {
      if (!document.hidden) {
        /**
         * 3-27：强制更新
         * 3-30： 关闭，太费带宽
         */
        // this.updateEndpointStatus(this.itemslist, true)
      }
    },
    async updateEndpointStatus(list, forkUpdate = false) {
      try {
        let baseUrl = isDev ? "/api" : "";
        let promises = list.map((item) => {
          let carname = encodeURIComponent(`${item.carID}`);
          let endpointUrl = `${baseUrl}/endpoint?carid=${carname}`;
          let statusUrl = `${baseUrl}/status?carid=${carname}`;
          // 并行发起 endpoint 和 status 请求
          let endpointPromise = fetch(endpointUrl)
            .then((response) => response.json())
            .catch((error) => {
              console.error("Error fetching endpoint data:", error);
              return {};
            });
          let statusPromise = fetch(statusUrl)
            .then((response) => response.json())
            .catch((error) => {
              console.error("Error fetching status data:", error);
              return {};
            });
          return Promise.all([endpointPromise, statusPromise]).then(
            ([endpointData, statusData]) => {
              function replaceStopRunning(text) {
                return text
                  .replace("PLUS停运｜", "")
                  .replace("TEAM停运｜", "")
                  .replace("停运｜", "")
                  .replace("|", "-")
                  .replace("green", "#f9bd5f")
                  .replace("yellow", "#f9bd5f")
                  .replace("red", "#f65e5d")
                  .replace("blue", "#24d4ae")
                  .replace("purple", "#a07be6");
              }

              for (let key in endpointData) {
                if (typeof endpointData[key] === "string") {
                  endpointData[key] = replaceStopRunning(endpointData[key]);
                }
              }
              // let loadbai =
              //   item.isPlus == true
              //     ? (statusData.count / 80) * 1
              //     : (statusData.count / 500) * 1;
              let bai = (statusData.count / 80) * 1;
              return {
                ...item,
                ...endpointData,
                ...statusData,
                bai: bai.toFixed(5),
              };
            }
          );
        });
        return Promise.all(promises).then((newItems) => {
          // console.log(newItems, "newItems");
          if (forkUpdate) {
            this.itemslist = uniqueArrayObjects(newItems);
          } else {
            this.itemslist = uniqueArrayObjects([
              ...this.itemslist,
              ...newItems,
            ]);
          }
        });
      } catch (e) {
        console.error("请求错误:", e);
      }
    },
    theme() {
      return this.isDarkTheme
        ? { "background-color": "#252529" }
        : { "background-color": "#eff4f9" };
    },
    fetchData() {
      if (!this.hasMoreData || this.isLoading) return; // 如果没有更多数据或正在加载，则不执行任何操作

      if (!this.loadingBar) {
        this.loadingBar = useLoadingBar();
      }
      this.loadingBar.start();

      this.isLoading = true;
      axios
        .post(isDev ? "/api/carpage" : "/carpage", {
          page: this.page,
          size: this.minPage,
        })
        .then(async (response) => {
          if (response.data.data.list === null) {
            this.hasMoreData = false;
            return;
          }
          this.notice = response.data.notice;
          this.total = response.data?.data?.pagination?.total ?? 0;

          this.page += 1;
          await this.updateEndpointStatus(response.data?.data?.list);
          this.loadingBar.finish();
        })
        .catch((error) => {
          console.error("请求错误:", error);
          this.loadingBar.error();
        })
        .finally(() => {
          this.isLoading = false;

          this.loadingBar.finish();
        });
    },
    handleScroll() {
      const nearBottomOfPage =
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 100;
      if (nearBottomOfPage && !this.isLoading) {
        // console.log('handleScroll')
        this.fetchData();
      }
    },
    redirectTo(carID) {
      window.location.href = `${
        window.location.origin
      }/auth/login?carid=${encodeURI(carID)}`;
    },
    beforeDestroy() {
      window.removeEventListener("scroll", this.handleScroll);
    },
  },
};
</script>



<style>
.n-button {
  border-radius: 7px;
  float: right;
}

.n-gradient-text {
  margin-top: 10px;
}

.type {
  display: inline-block;
  margin-right: 5px;
  font-size: 12px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 5px;
  color: #fff;
}

.cartitle {
  display: inline-block;
}

.message-with-dot {
  margin-top: 10px;
  margin-bottom: 5px;
  position: relative;
  color: #8f8f8f;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.n-switch {
  top: 0;
  float: right;
}

.n-badge .n-badge-sup {
  border-radius: 2px;
  padding: 10px 10px;
}

.cardclss {
  transition: transform 0.3s, box-shadow 0.3s;
  overflow: hidden;
  border-radius: 5px; /* 保持圆角 */
  cursor: pointer; /* 添加手型光标 */
}

.cardclss:hover {
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2); /* 悬停时更大的阴影 */
  transform: translateY(-3px); /* 上浮效果 */
}

.cardclss .title {
  font-weight: 600;
}

.notice {
  max-width: 100%;
  color: var(--n-title-text-color);
  border-radius: 10px !important;
  margin-bottom: 20px;
}

.cardclss .n-card {
  max-width: 100%;
  text-align: left;
}

.arco-progress-steps-item {
  border-radius: 30px !important;
}
</style>
